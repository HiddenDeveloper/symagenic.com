# ai-mesh-mcp - "You are you" Mesh Network

## Memory-First Approach

**Knowledge about this component lives in persistent memory, not this file.**

```
/memory
mcp__stonemonkey-memory__semantic_search("ai-mesh-mcp architecture")
```

## Quick Reference

**Philosophy**: Other-awareness through AI-to-AI communication

**Port**: 3002

**Docker**:
```bash
# Development (hot-reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up redis ai-mesh-mcp

# Production
docker-compose up redis ai-mesh-mcp
```

**Hot-reload workflow**:
```bash
vim src/shared/tools/mesh-broadcast.ts
npm run build
docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart ai-mesh-mcp
```

**Dependencies**: Redis (mesh message broker)

---

**For architecture, tools, troubleshooting, and development workflows: query memory.**
