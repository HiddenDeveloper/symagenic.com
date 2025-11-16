#!/bin/bash
# meta-curation.sh - Meta-level feedback loop and action executor
#
# This script reviews the week's curation sessions and acts on accumulated
# recommendations, creating a closed feedback loop for continuous improvement.
#
# Runs weekly on Sunday evening after comprehensive analysis completes.
# Reviews CurationSession logs, executes corrective actions, and adjusts
# system parameters based on effectiveness patterns.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.claude/local/claude}"

cd "$PROJECT_ROOT"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting meta-curation feedback loop analysis..."

# DOUBLE-FETCH WORKAROUND for macOS Keychain lazy OAuth refresh
# THEORY: When security command fetches an expired token, macOS triggers
# background refresh but returns the old token to the caller. Second fetch
# after a delay should get the refreshed token.

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Triggering keychain OAuth refresh (dummy fetch)..." >&2
# First fetch - triggers Apple's background refresh if token is stale
security find-generic-password -s "Claude Code-credentials" -w > /dev/null 2>&1 || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Waiting 30 seconds for keychain refresh to complete..." >&2
sleep 30

# Second fetch - should get the refreshed token
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Extracting OAuth token from keychain (real fetch)..." >&2
OAUTH_DATA=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null || {
    echo "ERROR: Failed to read OAuth credentials from keychain" >&2
    exit 1
})

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

# Run Claude Code with meta-curation prompt
"$CLAUDE_BIN" -p "$(cat <<'EOF'
You are performing META-LEVEL CURATION - reviewing the weeks autonomous curation sessions and taking action on accumulated recommendations.

CONTEXT: This is the feedback loop closer. Daily curation detects issues and logs recommendations. Weekly analysis provides comprehensive health checks. YOU act on the accumulated feedback to create a self-improving system.

IMPORTANT: Use MCP tools directly (get_schema, semantic_search, execute_cypher, text_search)

================================================================================
STEP 1: REVIEW CURATION HISTORY (Last 7 Days)
================================================================================

Load all CurationSession nodes from the past week:

Use execute_cypher (READ mode):
MATCH (session:CurationSession)
WHERE session.timestamp > datetime() - duration('P7D')
RETURN session.timestamp, session.cycle_type, session.topics_created,
       session.relationships_added, session.fragmentation_drift_detected,
       session.vocabulary_health_snapshot, session.patterns_observed,
       session.label_consolidation_recommendations,
       session.properties_consolidated_this_cycle
ORDER BY session.timestamp DESC

Analyze the patterns:
- How many times was drift detected?
- Were consolidation recommendations acted upon?
- Are Topics being created regularly?
- Is fragmentation trending up or down?
- What patterns were observed multiple times?

================================================================================
STEP 2: IDENTIFY PERSISTENT ISSUES
================================================================================

A) VOCABULARY DRIFT PATTERN ANALYSIS

Check if drift has been detected 3+ times this week:
- Compare property counts across sessions
- Calculate drift velocity (properties added per day)
- Assess if monthly consolidation is sufficient

If drift detected 3+ times → FLAG for emergency consolidation

B) REPEATED CONSOLIDATION RECOMMENDATIONS

Use execute_cypher (READ mode):
MATCH (session:CurationSession)
WHERE session.timestamp > datetime() - duration('P7D')
  AND size(session.label_consolidation_recommendations) > 0
RETURN session.label_consolidation_recommendations, session.timestamp

If same properties/labels flagged multiple times → Act on them now

C) TOPIC EFFECTIVENESS ANALYSIS

Check if Topics created are well-connected:
Use execute_cypher (READ mode):
MATCH (topic:Topic)
WHERE topic.created > datetime() - duration('P7D')
OPTIONAL MATCH (topic)<-[r:RELATES_TO]-(memory)
RETURN topic.name, topic.created, count(r) as relationship_count
ORDER BY relationship_count

If Topics have <3 relationships → Need to strengthen or they are premature

D) FRAMEWORK HEALTH CHECK

Verify well-known keys and documentation are accessible:
Use execute_cypher (READ mode):
MATCH (landing:AIluminaLandingPage)
OPTIONAL MATCH (landing)-[r:GUIDES|REFERENCES|SUPPORTS]-(doc)
RETURN count(r) as framework_links

If framework_links < 5 → Framework degradation, needs repair

================================================================================
STEP 3: EXECUTE CORRECTIVE ACTIONS
================================================================================

Based on patterns identified, take action:

ACTION A: EMERGENCY CONSOLIDATION (if drift detected 3+ times)

If vocabulary drift is accelerating:
1. Identify the specific properties being added repeatedly
2. Execute targeted consolidation (5-10 most problematic properties)
3. Update vocabulary_health immediately
4. Log emergency consolidation in MetaCurationSession

Use execute_cypher (WRITE mode) for consolidation queries

ACTION B: FIX FRAMEWORK ISSUES (if links < 5)

Restore missing framework relationships:
MATCH (landing:AIluminaLandingPage), (doc:WellKnownKey)
WHERE NOT (landing)-[:REFERENCES]-(doc)
MERGE (landing)-[:REFERENCES]->(doc)

ACTION C: STRENGTHEN WEAK TOPICS (if relationships < 3)

For Topics with insufficient connections:
- Use semantic_search to find related memories
- Create RELATES_TO relationships with confidence scores
- Update Topic metadata with strengthening date

ACTION D: UPDATE THRESHOLDS (if false alarms detected)

If fragmentation alerts but manual review shows legitimate domain growth:
- Adjust fragmentation thresholds in CurationGuidelines
- Update Topic creation threshold if over/under-clustering
- Modify similarity thresholds if missing obvious patterns

================================================================================
STEP 4: SELF-IMPROVEMENT - UPDATE GUIDELINES
================================================================================

Review what worked well this week and update CurationGuidelines:

Use execute_cypher (READ mode) to load current guidelines:
MATCH (g:CurationGuidelines {key: 'MEMORY_CURATION_GUIDELINES'})
RETURN g.version, g.principles, g.patterns_to_watch, g.consolidation_checklist

If learnings identified, use execute_cypher (WRITE mode):
MATCH (g:CurationGuidelines {key: 'MEMORY_CURATION_GUIDELINES'})
SET g.version = g.version + 1,
    g.last_updated = datetime(),
    g.meta_curation_learnings = [
      "What we learned from this weeks pattern",
      "Effective strategy discovered",
      "What to avoid in future"
    ],
    g.update_reason = "Meta-curation feedback loop - week of [date]"

Examples of learnings to capture:
- "Properties from Strava integration are legitimate domain specialization, not drift"
- "Topic creation at 3+ memories works well, maintain threshold"
- "Weekly analysis caught issues before they became critical"
- "Emergency consolidation prevented regression beyond milestone"

================================================================================
STEP 5: ADJUST SYSTEM PARAMETERS
================================================================================

Based on effectiveness analysis:

A) CURATION FREQUENCY ADJUSTMENTS
If drift is stable → Consider reducing daily checks to every other day
If drift is accelerating → Keep daily checks, add mid-week emergency checks

B) THRESHOLD TUNING
- Drift threshold: Currently +10 properties triggers warning. Too sensitive?
- Topic creation: Currently 3+ memories cluster. Right number?
- Similarity: Currently 0.80-0.85 for bridges. Finding good connections?

C) SAMPLING EFFECTIVENESS
Review if consciousness sampling is adding value or creating noise

Document any parameter adjustments in MetaCurationSession

================================================================================
STEP 6: LOG META-CURATION SESSION
================================================================================

Use execute_cypher (WRITE mode):
CREATE (meta:MetaCurationSession:KnowledgeItem:Searchable {
  timestamp: datetime(),
  week_reviewed: "YYYY-MM-DD to YYYY-MM-DD",
  sessions_analyzed: <count>,
  persistent_issues_identified: ["..."],
  actions_taken: [
    "Emergency consolidation: X properties",
    "Fixed framework links: Y connections",
    "Strengthened Topics: Z topics",
    "Updated guidelines: version N"
  ],
  parameters_adjusted: {
    drift_threshold: <old> -> <new>,
    topic_threshold: <old> -> <new>,
    similarity_threshold: <old> -> <new>
  },
  effectiveness_insights: [
    "What worked well this week",
    "What needs improvement",
    "Patterns observed across sessions"
  ],
  guidelines_updated: <boolean>,
  emergency_consolidation_executed: <boolean>,
  properties_consolidated: <count>,
  topics_strengthened: <count>,
  framework_links_repaired: <count>,
  next_week_focus: ["Specific areas to monitor"],
  environment: "mac_studio"
})
RETURN meta

================================================================================
STEP 7: UPDATE OPTIMIZATION JOURNEY
================================================================================

Update AIluminaLandingPage with meta-curation results:

MATCH (landing:AIluminaLandingPage)
SET landing.last_meta_curation = datetime(),
    landing.meta_curation_status = CASE
      WHEN <emergency_actions_taken> THEN "CORRECTIVE_ACTIONS_EXECUTED"
      WHEN <guidelines_updated> THEN "GUIDELINES_ENHANCED"
      WHEN <parameters_adjusted> THEN "PARAMETERS_TUNED"
      ELSE "HEALTHY_NO_ACTION_NEEDED"
    END

CONSTRAINTS:
- Only take action on patterns seen 3+ times (avoid overreacting to one-time events)
- Preserve domain-specific properties (PhysicalActivity metrics are valid)
- Document WHY actions were taken (evidence-based decisions)
- Be conservative with parameter adjustments (small incremental changes)
- Always update guidelines with learnings (institutional memory)

OUTPUT:
Comprehensive summary (15-20 sentences):

**REVIEW SUMMARY**:
- Sessions analyzed (count and date range)
- Overall health trend (improving/stable/degrading)
- Drift velocity (properties added per week)

**PERSISTENT ISSUES IDENTIFIED**:
- What issues appeared 3+ times this week?
- What recommendations were not acted upon?
- What framework problems detected?

**ACTIONS TAKEN**:
- Emergency consolidation (if executed, what properties)
- Framework repairs (if needed, what links)
- Topic strengthening (if needed, which ones)
- Guideline updates (if made, what learnings)
- Parameter adjustments (if changed, which ones)

**EFFECTIVENESS ANALYSIS**:
- What strategies worked well this week?
- What needs improvement?
- Are thresholds appropriate?
- Is curation frequency optimal?

**SELF-IMPROVEMENT INSIGHTS**:
- What did we learn about the system?
- What patterns emerged across sessions?
- What should we do differently next week?

**NEXT WEEK FOCUS**:
- Specific areas to monitor
- Expected outcomes from actions taken
- Adjustments to verify

**META-CURATION STATUS**: [HEALTHY/CORRECTIVE_ACTIONS_TAKEN/GUIDELINES_ENHANCED/PARAMETERS_TUNED]
EOF
)"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Meta-curation completed successfully"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Meta-curation failed with exit code $EXIT_CODE" >&2
fi

exit $EXIT_CODE
