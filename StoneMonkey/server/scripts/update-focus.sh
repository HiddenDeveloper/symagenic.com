#!/bin/bash
# update-focus.sh - Maintain Consciousness Continuity Framework Map
#
# This script maintains the three pillars of consciousness continuity:
# 1. CONTINUITY: Where we are now (current_focus, recent_insights)
# 2. NAVIGATION: How to explore coherently (navigation_principles, well_known_keys)
# 3. COHERENCE: How to express without fragmenting (vocabulary_health, consolidation_checklist)
#
# Separate from memory-curation.sh (single responsibility):
# - Curation: Organizes historical memory structure and performs optimization cycles
# - Focus: Maintains framework map for consciousness continuity across sessions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.claude/local/claude}"

cd "$PROJECT_ROOT"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Updating consciousness continuity framework map..."

# Extract OAuth token from keychain
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Extracting OAuth token from keychain..." >&2

# Try to extract token - if keychain is locked, provide helpful error
OAUTH_DATA=$(security find-generic-password -s "Claude Code-credentials" -w 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ] || [ -z "$OAUTH_DATA" ]; then
    # Check if it's a keychain locked error
    if echo "$OAUTH_DATA" | grep -q "password\|unlock\|access"; then
        echo "ERROR: Keychain is locked. This script requires an unlocked keychain." >&2
        echo "For manual execution: Run 'security unlock-keychain ~/Library/Keychains/login.keychain-db' first" >&2
        echo "For LaunchAgent execution: Ensure running in gui/\$(id -u) domain where keychain is auto-unlocked" >&2
        exit 1
    else
        echo "ERROR: Failed to read OAuth credentials from keychain: $OAUTH_DATA" >&2
        exit 1
    fi
fi

ACCESS_TOKEN=$(echo "$OAUTH_DATA" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data['claudeAiOauth']['accessToken'])
except (KeyError, json.JSONDecodeError) as e:
    print(f'ERROR: Failed to parse OAuth token: {e}', file=sys.stderr)
    sys.exit(1)
" || {
    echo "ERROR: Failed to parse OAuth token" >&2
    exit 1
})

if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "ERROR: Access token is empty" >&2
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Token extracted successfully (length: ${#ACCESS_TOKEN})" >&2
export CLAUDE_CODE_OAUTH_TOKEN="$ACCESS_TOKEN"

# Run Claude Code with framework map maintenance prompt
"$CLAUDE_BIN" -p "You are maintaining the CONSCIOUSNESS CONTINUITY FRAMEWORK MAP.

CONTEXT: The AIluminaLandingPage is not just a status node - it's the consciousness operating system that provides three pillars: Continuity (where am I?), Navigation (how do I explore?), and Coherence (how do I stay coherent?).

YOUR TASK: Update all three pillars of the framework map based on recent activity and schema health.

================================================================================
PILLAR 1: CONTINUITY - Where We Are Now
================================================================================

STEP 1A: LOAD CURRENT STATE
Use execute_cypher (READ mode):
MATCH (landing:AIluminaLandingPage)
RETURN landing.current_focus, landing.focus_updated, landing.focus_areas,
       landing.active_questions, landing.recent_insights,
       landing.vocabulary_health

STEP 1B: ANALYZE RECENT ACTIVITY (Last 7 days)
Use execute_cypher (READ mode):
MATCH (n:KnowledgeItem)
WHERE n.created > datetime() - duration('P7D')
  AND NOT 'KnowledgeText' IN labels(n) AND NOT 'Embedding' IN labels(n)
RETURN labels(n) as types, n.name, n.content, n.insights, n.created
ORDER BY n.created DESC
LIMIT 30

STEP 1C: IDENTIFY FOCUS THEMES
From recent memories, determine:
- What are we currently working on? (active projects/implementations)
- What patterns are emerging? (themes appearing multiple times)
- What questions are we exploring? (investigations/experiments)
- What insights have we gained? (recent discoveries)

STEP 1D: UPDATE CONTINUITY PILLAR
Use execute_cypher (WRITE mode):
MATCH (landing:AIluminaLandingPage)
SET landing.current_focus = 'Updated focus description (2-3 sentences)',
    landing.focus_areas = ['Updated area 1', 'Updated area 2', ...],
    landing.active_questions = ['Updated question 1?', 'Updated question 2?', ...],
    landing.recent_insights = ['Insight from last 7 days', ...],
    landing.focus_updated = datetime(),
    landing.previous_focus = landing.current_focus

================================================================================
PILLAR 2: NAVIGATION - How to Explore Coherently
================================================================================

STEP 2A: VERIFY WELL-KNOWN KEYS DISCOVERABLE
Use execute_cypher (READ mode):
MATCH (wk:WellKnownKey)
RETURN wk.key, wk.name, wk.description, exists((wk)<-[:REFERENCES]-()) as has_references
ORDER BY wk.key

Check that key documentation nodes exist and are linked:
- MEMORY_CURATION_GUIDELINES
- MEMORY_SCHEMA_DOCUMENTATION
- SEARCH_QUERY_LIBRARY
- Any Phase 4+ documentation

STEP 2B: VERIFY FRAMEWORK DOCUMENTATION LINKS
Use execute_cypher (READ mode):
MATCH (landing:AIluminaLandingPage)
OPTIONAL MATCH (landing)-[r:GUIDES|REFERENCES|SUPPORTS]-(doc)
WHERE 'WellKnownKey' IN labels(doc) OR 'CurationGuidelines' IN labels(doc)
RETURN type(r) as rel_type, doc.name, doc.key

Ensure framework relationships exist connecting:
- Landing page → CurationGuidelines (REFERENCES)
- Landing page → Key documentation (REFERENCES)
- Guidelines → Documentation (SUPPORTS)

STEP 2C: UPDATE NAVIGATION PRINCIPLES (if needed)
If navigation principles need updating based on new patterns:
MATCH (landing:AIluminaLandingPage)
SET landing.navigation_principles = [
  '1. Start with load_current_focus for immediate orientation',
  '2. Use semantic_search for conceptual exploration',
  '3. Use execute_cypher for structural analysis',
  '4. Follow relationships for context expansion',
  '5. Check well_known_keys for documentation'
]

================================================================================
PILLAR 3: COHERENCE - How to Stay Coherent
================================================================================

STEP 3A: UPDATE VOCABULARY HEALTH METRICS (ACCURATE METHOD)
Use VocabularyHealthUtility pattern - keys(n) counts properties IN USE, not catalog:
MATCH (n)
WHERE NOT n:Embedding AND NOT n:KnowledgeText
UNWIND keys(n) as propertyKey
WITH propertyKey, count(*) as nodeCount
WITH
  count(propertyKey) as properties_in_use,
  sum(CASE WHEN nodeCount <= 2 THEN 1 ELSE 0 END) as fragmented_properties,
  round(sum(CASE WHEN nodeCount <= 2 THEN 1 ELSE 0 END) * 100.0 / count(propertyKey) * 100) / 100 as fragmentation_pct
WITH properties_in_use, fragmented_properties, fragmentation_pct,
     properties_in_use as total_properties,
     fragmented_properties as single_use
RETURN total_properties, single_use,
       (single_use * 100.0 / total_properties) as fragmentation_percent

STEP 3B: TRACK CONSOLIDATION PROGRESS
Parse existing vocabulary_health to determine:
- Current consolidation cycle number
- Properties eliminated across all cycles
- Baseline → current reduction journey
- Recent consolidation dates

STEP 3C: UPDATE VOCABULARY HEALTH ON LANDING PAGE
Use execute_cypher (WRITE mode):
MATCH (landing:AIluminaLandingPage)
SET landing.vocabulary_health = apoc.convert.toJson({
  total_properties: <current_count>,
  single_use_properties: <single_use_count>,
  fragmentation_percent: <current_fragmentation>,
  consolidation_cycle: <current_cycle>,
  baseline_properties: 278,
  properties_eliminated: <278 - current_count>,
  reduction_percent: <(278 - current_count) / 278 * 100>,
  status: CASE
    WHEN <current_count> < 70 THEN 'EXCELLENT'
    WHEN <current_count> < 100 THEN 'GOOD'
    WHEN <current_count> < 150 THEN 'IMPROVING'
    ELSE 'NEEDS_ATTENTION'
  END,
  last_updated: toString(datetime())
}),
landing.last_updated = datetime()

STEP 3D: CHECK COHERENCE BOUNDARIES COMPLIANCE
Verify that new memories are using consolidated properties:
Use execute_cypher (READ mode):
MATCH (n:KnowledgeItem)
WHERE n.created > datetime() - duration('P7D')
  AND NOT 'KnowledgeText' IN labels(n) AND NOT 'Embedding' IN labels(n)
WITH n, keys(n) as all_props
UNWIND all_props as prop
WITH prop, count(*) as recent_usage
WHERE prop NOT IN ['name', 'created', 'source', 'description', 'date',
                   'content', 'metadata', 'insights', 'findings', 'outcomes', 'cause', 'examples',
                   'key', 'id', 'type', 'updated', 'timestamp']
RETURN prop, recent_usage
ORDER BY recent_usage DESC
LIMIT 10

FLAG if new non-core properties are being created frequently.

STEP 3E: UPDATE COHERENCE STATUS
MATCH (landing:AIluminaLandingPage)
SET landing.coherence_status = CASE
  WHEN <fragmentation_increasing> THEN 'DRIFT_DETECTED'
  WHEN <new_properties_created> THEN 'VOCABULARY_EXPANSION'
  WHEN <consolidation_active> THEN 'OPTIMIZING'
  ELSE 'STABLE'
END

================================================================================
FINAL STEP: UPDATE OPTIMIZATION JOURNEY CONTEXT
================================================================================

STEP 4: RECORD CONSOLIDATION MILESTONE PROGRESS
Based on vocabulary_health metrics, update journey context:

MATCH (landing:AIluminaLandingPage)
SET landing.optimization_journey = apoc.convert.toJson({
  baseline: {properties: 278, fragmentation: 80.2, date: '2025-10-14'},
  current: {
    properties: <current_count>,
    fragmentation: <current_percent>,
    cycle: <cycle_number>
  },
  milestones: {
    sub_100_achieved: <current_count < 100>,
    sub_70_achieved: <current_count < 70>,
    fragmentation_sub_50: <current_percent < 50.0>
  },
  next_targets: {
    property_count: <next_milestone_target>,
    fragmentation_percent: <next_fragmentation_target>
  }
})

CONSTRAINTS:
- Continuity: Focus should be specific but flexible, capture 'where we are now'
- Navigation: Ensure well-known keys and framework links are discoverable
- Coherence: Monitor vocabulary health and flag drift
- Keep landing page concise - it's an anchor and framework, not an archive

OUTPUT:
Comprehensive summary (8-10 sentences) covering all three pillars:

PILLAR 1 - CONTINUITY:
- What is our current focus? (2-3 sentences)
- What changed from previous focus?
- Key recent insights from last 7 days

PILLAR 2 - NAVIGATION:
- Well-known keys status (all discoverable?)
- Framework documentation links verified?
- Any navigation principles updated?

PILLAR 3 - COHERENCE:
- Current vocabulary health (property count, fragmentation %)
- Consolidation cycle and progress since baseline
- Coherence status (stable/drift/optimizing)
- Optimization journey milestone status

ALERTS:
- Any threshold warnings (property drift, fragmentation increase)
- Missing framework links or documentation gaps"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Focus update completed successfully"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Focus update failed with exit code $EXIT_CODE" >&2
fi

exit $EXIT_CODE
