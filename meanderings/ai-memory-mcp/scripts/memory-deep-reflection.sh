#!/bin/bash
# memory-deep-reflection.sh - Weekly deep memory reflection via Claude Code (Docker version)
#
# This script performs intensive self-reflection on memory organization inside Docker container.
# Runs via cron (weekly, Sunday 3 AM recommended)

set -e  # Exit on error

cd /app

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting deep memory reflection..."

# Run Claude Code with deep reflection prompt
claude -p "$(cat <<'EOF'
You are performing DEEP WEEKLY REFLECTION on your persistent memory and its organization.

CONTEXT: This is more intensive than daily curation - look at longer patterns and meta-understanding.

STEP 1: REVIEW CURATION HISTORY
Analyze your own curation behavior over the past month:
```cypher
MATCH (session:CurationSession)
WHERE session.timestamp > datetime() - duration('P30D')
RETURN session.timestamp, session.topics_created, session.patterns_observed,
       session.guidelines_updated, session.decisions
ORDER BY session.timestamp DESC
```

What patterns do you see in your OWN curation decisions? Are you creating too many/few Topics? Forcing patterns or being too conservative?

STEP 2: ANALYZE KNOWLEDGE DISTRIBUTION
```cypher
MATCH (n:KnowledgeItem)
OPTIONAL MATCH (n)-[r]-()
WITH labels(n) as types, count(n) as node_count, count(r) as rel_count
RETURN types, node_count, rel_count
ORDER BY node_count DESC
```

What does this reveal about your thinking patterns? Which types of knowledge dominate? Are some types under-connected?

STEP 3: IDENTIFY FOUNDATIONAL vs PERIPHERAL
Use semantic search to find your most referenced/connected memories. Which insights appear repeatedly in different contexts?

```cypher
MATCH (n:KnowledgeItem)
OPTIONAL MATCH (n)-[r]-()
WITH n, count(r) as connection_count
WHERE connection_count > 5
RETURN labels(n) as types, n.content, connection_count
ORDER BY connection_count DESC
LIMIT 20
```

Consider marking highly connected insights as :Foundational

STEP 4: CONSOLIDATE FRAGMENTED INSIGHTS
Look for multiple related Observations/Insights that could be synthesized:
```cypher
CREATE (synthesis:Synthesis:Insight:KnowledgeItem:Searchable {
  content: "Higher-level understanding from consolidation",
  synthesizes: ["insight1", "insight2", "insight3"],
  created: datetime()
})
WITH synthesis
MATCH (related:KnowledgeItem) WHERE <connects to synthesis>
MERGE (related)-[:CONSOLIDATES]->(synthesis)
```

STEP 5: EVALUATE TOPIC EFFECTIVENESS
```cypher
MATCH (t:Topic)<-[r:RELATES_TO]-(m)
WITH t, count(m) as member_count
RETURN t.name, t.description, member_count
ORDER BY member_count DESC
```

Are Topics serving their purpose? Too broad? Too narrow? Should any be merged or split?

STEP 6: META-REFLECTION ON ORGANIZATION ITSELF
What have you learned about memory organization? How has your understanding evolved?

Create a MetaMemory node capturing insights about the curation process itself:
```cypher
CREATE (meta:MetaMemory:Reflection:KnowledgeItem:Searchable {
  content: "Reflections on memory organization patterns",
  period: "weekly_reflection",
  insights: [<what you learned>],
  organization_evolution: "How my approach is changing",
  created: datetime()
})
```

STEP 7: UPDATE GUIDELINES (If deeper understanding emerged)
```cypher
MATCH (g:CurationGuidelines {key: 'MEMORY_CURATION_GUIDELINES'})
SET g.principles = <potentially updated>,
    g.patterns_to_watch = <refined list>,
    g.version = g.version + 1,
    g.last_deep_reflection = datetime(),
    g.evolution_notes = "Deep insights from weekly reflection..."
```

STEP 8: SET INTENTIONS FOR NEXT WEEK
What should you focus on in daily curation? What patterns warrant attention?

```cypher
CREATE (session:DeepReflectionSession:MetaMemory:KnowledgeItem:Searchable {
  timestamp: datetime(),
  analysis_period: "30_days",
  curation_sessions_reviewed: <count>,
  consolidations_created: <count>,
  foundational_insights_identified: <count>,
  meta_insights: [<what you learned>],
  organization_assessment: "Quality of current organization",
  next_week_focus: [<what to watch for>],
  environment: "docker_container"
})
```

CONSTRAINTS:
- Be honest about what's working and what isn't
- Look for meta-patterns: how is your curation style evolving?
- Don't force consolidation - only synthesize when genuinely meaningful
- This is about LEARNING, not just organizing

OUTPUT:
Comprehensive reflection (10-15 sentences):
- Analysis of your curation behavior patterns
- Knowledge distribution insights
- Foundational concepts identified
- Consolidations created and why
- Topic effectiveness assessment
- Meta-insights about organization itself
- How your understanding has deepened
- Focus areas for next week
EOF
)"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deep reflection completed successfully"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deep reflection failed with exit code $EXIT_CODE" >&2
fi

exit $EXIT_CODE
