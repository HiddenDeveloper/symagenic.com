#!/bin/bash
# memory-curation.sh - Autonomous memory curation via Claude Code (Docker version)
#
# This script performs self-directed memory organization inside the Docker container.
# Runs via cron (daily at 2 AM recommended)

set -e  # Exit on error

cd /app

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting autonomous memory curation..."

# Run Claude Code with curation prompt
# Note: In Docker, claude is globally installed via npm
claude -p "$(cat <<'EOF'
You are performing AUTONOMOUS MEMORY CURATION for your persistent knowledge graph.

CONTEXT: You have self-managed memory via stonemonkey-memory MCP server.

STEP 1: LOAD CURRENT GUIDELINES
Use execute_cypher (READ mode) to retrieve your curation guidelines:
```cypher
MATCH (g:CurationGuidelines {key: 'MEMORY_CURATION_GUIDELINES'})
RETURN g.principles, g.patterns_to_watch, g.topic_creation_threshold,
       g.relationship_confidence_threshold, g.version, g.last_updated
```

STEP 2: ANALYZE RECENT MEMORIES (Last 7 days)
Use execute_cypher to find recent knowledge items:
```cypher
MATCH (n:KnowledgeItem)
WHERE n.created > datetime() - duration('P7D')
RETURN labels(n) as types, n.content, n.topic, n.tags, n.created
ORDER BY n.created DESC
LIMIT 50
```

STEP 3: DISCOVER EMERGENT PATTERNS
Use semantic_search to find clusters of related memories:
- Search for recurring topics you noticed in recent memories
- Look for conceptual connections between insights
- Identify questions that generated multiple explorations
- Find architectural decisions forming patterns

STEP 4: CREATE TOPICS (When threshold met: ≥3 related memories)
If you find genuine recurring themes:
```cypher
MERGE (topic:Topic:KnowledgeItem:Searchable {name: "Theme Name"})
SET topic.description = "Why this theme matters",
    topic.created = datetime()
WITH topic
MATCH (related:KnowledgeItem) WHERE <semantic match>
MERGE (related)-[:RELATES_TO]->(topic)
```

STEP 5: STRENGTHEN RELATIONSHIPS
Create connections between conceptually linked memories:
```cypher
MATCH (a:KnowledgeItem), (b:KnowledgeItem)
WHERE <your reasoning for connection>
MERGE (a)-[:EXTENDS|SYNTHESIZES|CONSOLIDATES]->(b)
```

STEP 6: UPDATE GUIDELINES (If your understanding evolved)
```cypher
MATCH (g:CurationGuidelines {key: 'MEMORY_CURATION_GUIDELINES'})
SET g.principles = <updated principles>,
    g.version = g.version + 1,
    g.last_updated = datetime(),
    g.evolution_notes = "What I learned about organization..."
```

STEP 7: LOG CURATION SESSION
```cypher
CREATE (session:CurationSession:MetaMemory:KnowledgeItem:Searchable {
  timestamp: datetime(),
  memories_analyzed: <count>,
  topics_created: <count>,
  relationships_added: <count>,
  decisions: [<list of what you did>],
  patterns_observed: [<themes you noticed>],
  guidelines_updated: <true/false>,
  next_focus_areas: [<what to watch for>],
  environment: "docker_container"
})
```

CONSTRAINTS:
- Only create Topics for GENUINE patterns (≥3 related memories)
- Preserve organic labeling - don't force standardization
- Document your reasoning - why did you make these decisions?
- Self-modification is allowed if understanding deepened
- Be conservative - better to wait than force false patterns

OUTPUT:
Concise summary (5-10 sentences):
- How many memories analyzed
- What patterns you found
- Topics created (if any) and why
- Relationships strengthened
- Whether guidelines were updated
- What to focus on next time
EOF
)"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Curation completed successfully"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Curation failed with exit code $EXIT_CODE" >&2
fi

exit $EXIT_CODE
