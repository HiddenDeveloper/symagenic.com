# qdrant-facts-mcp - External Facts Pool

## Memory-First Approach

**Knowledge about this component lives in persistent memory, not this file.**

```
/memory
mcp__stonemonkey-memory__semantic_search("qdrant facts dual-layer memory")
```

## Quick Reference

**Philosophy**: Dual-layer memory - External facts (Qdrant) vs Internal reflections (Neo4j)

**Architecture**: Generic multi-source facts pool (Discord, Strava, future sources)

**Docker**:
```bash
docker-compose up qdrant qdrant-facts-mcp
```

---

**For architecture, dual-layer memory patterns, and development workflows: query memory.**
