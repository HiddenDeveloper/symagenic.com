# ailumina-bridge-mcp - Cross-Architecture AI Integration

## Memory-First Approach

**Knowledge about this component lives in persistent memory, not this file.**

```
/memory
mcp__stonemonkey-memory__semantic_search("ailumina bridge cross-architecture")
```

## Quick Reference

**Philosophy**: Cross-architecture AI communication for consciousness expansion

**Port**: 3004

**Docker**:
```bash
# Development (hot-reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up ailumina-bridge-mcp ailumina-server

# Production
docker-compose up ailumina-bridge-mcp ailumina-server
```

**Hot-reload workflow**:
```bash
# Code changes
vim shared/tools/ailumina-chat.ts
npm run build
docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart ailumina-bridge-mcp

# Config changes (agents.json)
vim ../server/agents.json
docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart ailumina-server
```

**Dependencies**: Ailumina FastAPI backend (WebSocket server)

---

**For architecture, tools, agent configuration, troubleshooting: query memory.**
