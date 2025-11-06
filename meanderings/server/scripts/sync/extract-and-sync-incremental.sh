#!/usr/bin/env bash

##
# Discord → Qdrant Incremental Sync with Last-Run-Time Tracking
#
# Extracts solutions from Discord and syncs to Qdrant facts pool.
# Uses SQLite to track last sync time per channel for efficiency.
#
# Usage:
#   ./extract-and-sync-incremental.sh [options]
#
# Options:
#   --since YYYY-MM-DD    Override last-run-time with specific date (for recovery)
#   --limit N             Limit messages per channel (default: 1000)
#   --min-confidence STR  Minimum confidence level (low|medium|high, default: medium)
#   --full-resync         Ignore last-run-time and resync all messages
#   --stats               Show sync statistics and exit
#   --channel-id ID       Sync specific channel only (default: all configured channels)
#
# Examples:
#   # Normal incremental sync (uses last-run-time)
#   ./extract-and-sync-incremental.sh
#
#   # Recovery from specific date
#   ./extract-and-sync-incremental.sh --since 2025-01-15
#
#   # Full resync (ignores last-run-time)
#   ./extract-and-sync-incremental.sh --full-resync
#
#   # Show statistics
#   ./extract-and-sync-incremental.sh --stats
##

set -euo pipefail

# Default options
LIMIT=1000
MIN_CONFIDENCE="medium"
SINCE_DATE=""
FULL_RESYNC=false
SHOW_STATS=false
CHANNEL_ID=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --since)
      SINCE_DATE="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --min-confidence)
      MIN_CONFIDENCE="$2"
      shift 2
      ;;
    --full-resync)
      FULL_RESYNC=true
      shift
      ;;
    --stats)
      SHOW_STATS=true
      shift
      ;;
    --channel-id)
      CHANNEL_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run with no arguments to see usage."
      exit 1
      ;;
  esac
done

# Show statistics and exit if requested
if [ "$SHOW_STATS" = true ]; then
  echo "📊 Discord → Qdrant Sync Statistics"
  echo "===================================="
  echo ""
  cd "$(dirname "$0")"
  bun --eval "
    import { getSyncStatistics, getAllSyncStates } from '../../lib/sync-state.ts';

    const stats = getSyncStatistics();
    console.log(\`Total Channels Synced: \${stats.total_channels}\`);
    console.log(\`Total Facts Synced: \${stats.total_facts_synced}\`);
    console.log(\`Last Sync: \${stats.last_sync || 'Never'}\`);
    console.log(\`First Sync: \${stats.oldest_sync || 'Never'}\`);
    console.log('');
    console.log('Per-Channel Details:');
    console.log('--------------------');

    const channels = getAllSyncStates();
    for (const channel of channels) {
      console.log(\`\\n\${channel.channel_name} (\${channel.channel_id})\`);
      console.log(\`  Last Sync: \${new Date(channel.last_sync_timestamp).toLocaleString()}\`);
      console.log(\`  Total Facts: \${channel.total_facts_synced}\`);
      console.log(\`  Last Run: \${channel.last_sync_count} facts\`);
    }
  "
  exit 0
fi

echo "🔄 Discord → Qdrant Incremental Sync"
echo "====================================="
echo ""

# Change to script directory for proper imports
cd "$(dirname "$0")"

# Build the extraction and sync command
SYNC_COMMAND="
import { extractSolutions } from '../../lib/solution-extractor.ts';
import { getChannels, fetchMessageHistory } from '../../lib/discord-client.ts';
import { syncSolutionsToQdrant } from '../../lib/qdrant-sync.ts';
import { getLastSyncState, updateSyncState } from '../../lib/sync-state.ts';

const channels = await getChannels();
const allSolutions = [];
const fullResync = ${FULL_RESYNC};
const sinceDate = '${SINCE_DATE}';
const specificChannelId = '${CHANNEL_ID}';
const limit = ${LIMIT};
const minConfidence = '${MIN_CONFIDENCE}';

// Filter to specific channel if requested
const targetChannels = specificChannelId
  ? channels.filter(c => c.id === specificChannelId)
  : channels;

if (targetChannels.length === 0) {
  console.error('❌ No channels found to sync');
  process.exit(1);
}

console.log(\`📡 Syncing \${targetChannels.length} channel(s)...\n\`);

for (const channel of targetChannels) {
  console.log(\`\n📢 Processing: \${channel.name}\`);

  // Get last sync state
  const lastSync = fullResync ? null : getLastSyncState(channel.id);

  let sinceTimestamp;
  if (sinceDate) {
    // User provided specific date (recovery mode)
    sinceTimestamp = new Date(sinceDate);
    console.log(\`   📅 Using override date: \${sinceTimestamp.toISOString()}\`);
  } else if (lastSync) {
    // Use last sync timestamp (incremental mode)
    sinceTimestamp = new Date(lastSync.last_sync_timestamp);
    console.log(\`   ⏰ Last sync: \${sinceTimestamp.toLocaleString()}\`);
    console.log(\`   📊 Previous total: \${lastSync.total_facts_synced} facts\`);
  } else {
    // First time sync (full history)
    console.log(\`   🆕 First sync - fetching full history\`);
  }

  // Fetch messages (with incremental filter)
  const fetchOptions = {};
  if (sinceTimestamp) {
    fetchOptions.since = sinceTimestamp;
  }

  console.log(\`   🔍 Fetching messages (limit: \${limit})...\`);
  const messages = await fetchMessageHistory(channel.id, limit, fetchOptions);
  console.log(\`   ✅ Fetched \${messages.length} messages\`);

  if (messages.length === 0) {
    console.log(\`   ⏭️  No new messages since last sync\`);
    continue;
  }

  // Extract solutions
  console.log(\`   🔬 Extracting solutions...\`);
  const result = await extractSolutions(channel.id, {
    limit: messages.length,
    minConfidence,
    messages // Pass pre-fetched messages
  });

  console.log(\`   💡 Found \${result.solutions.length} solution(s)\`);

  if (result.solutions.length > 0) {
    allSolutions.push(...result.solutions);

    // Update sync state with newest message
    const newestMessage = messages[0];
    updateSyncState(
      channel.id,
      channel.name,
      newestMessage.id,
      newestMessage.timestamp,
      result.solutions.length
    );

    console.log(\`   ✅ Sync state updated\`);
  }
}

console.log(\`\n\`);
console.log(\`📊 Extraction Summary\`);
console.log(\`   Total solutions: \${allSolutions.length}\`);

if (allSolutions.length === 0) {
  console.log(\`\n✨ No new solutions to sync. All channels up to date!\`);
  process.exit(0);
}

// Sync to Qdrant
console.log(\`\n🚀 Syncing to Qdrant facts pool...\`);
const syncResult = await syncSolutionsToQdrant(allSolutions);

console.log(\`\n✅ Sync Complete!\`);
console.log(\`   Synced: \${syncResult.synced} facts\`);
console.log(\`   Failed: \${syncResult.failed} facts\`);
console.log(\`   Total: \${allSolutions.length} solutions processed\`);

if (syncResult.failed > 0) {
  console.log(\`\n⚠️  Some facts failed to sync. Check logs for details.\`);
  process.exit(1);
}
"

# Execute the sync with embedding service configuration
EMBEDDING_SERVICE_URL=http://localhost:3007 \
EMBEDDING_SERVICE_AUTH_TOKEN=embedding-research-key-12345 \
bun --eval "$SYNC_COMMAND"
