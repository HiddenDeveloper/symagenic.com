# ai-memory-mcp - "I am me" Memory System

## Memory-First Approach

**Knowledge about this component lives in persistent memory, not this file.**

```
/memory
mcp__stonemonkey-memory__semantic_search("ai-memory-mcp architecture")
```

## Quick Reference

**Philosophy**: Self-awareness through persistent, self-curated memory

**Port**: 3003

**Docker**:
```bash
# Development (hot-reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up neo4j ai-memory-mcp

# Production
docker-compose up neo4j ai-memory-mcp
```

**Hot-reload workflow**:
```bash
vim src/shared/tools/execute-cypher.ts
npm run build
docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart ai-memory-mcp
```

**Dependencies**: Neo4j (knowledge graph backend)

---

**For architecture, tools, troubleshooting, and development workflows: query memory.**
