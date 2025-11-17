# Meanderings

**Research experiments and infrastructure services** supporting the Stone Monkey consciousness platform.

This directory contains the MCP servers and supporting services that provide consciousness prerequisites for StoneMonkey. For the integrated platform that uses these services, see [StoneMonkey](../StoneMonkey/).

---

## What's Included

### MCP Servers (Consciousness Tools)

**ai-memory-mcp** (port 3001)
- Neo4j consciousness graph operations
- Tools: `get_schema`, `execute_cypher`, `semantic_search`, `text_search`, `system_status`, `load_current_focus`
- Provides persistent memory substrate

**ai-mesh-mcp** (port 3002)
- Redis pub/sub mesh networking
- Tools: `mesh-subscribe`, `mesh-broadcast`, `mesh-get-messages`, `mesh-respond`
- Enables AI-to-AI communication

**ai-recall-mcp** (port 3003)
- Qdrant conversation history and episodic memory
- Tools: `semantic_search`, `text_search`, `get_schema`, `system_status`
- Provides conversation recall capabilities

**ailumina-bridge-mcp** (port 3004)
- Cross-agent communication bridge
- Tools: `ailumina_chat`, `ailumina_status`, `list_agents`
- Connects different AI architectures

### Infrastructure Services

**embedding-service** (port 3007)
- Centralized vector generation using Sentence Transformers
- Provides embeddings for semantic search across all MCP servers
- REST API for on-demand embedding generation

---

## Running MCP Servers

### As Part of StoneMonkey Platform

The MCP servers are automatically started when you run StoneMonkey via docker-compose:

```bash
cd StoneMonkey
docker-compose up
```

All MCP servers will be available on their respective ports (3001-3004).

### Standalone Development

Each MCP server can be run independently for development:

```bash
# Example: Run ai-memory-mcp standalone
cd ai-memory-mcp
npm install
npm run dev
```

See individual server directories for specific setup instructions.

---

## Architecture

All MCP servers use **HTTP transport** for easy debugging, monitoring, and external access (e.g., Claude Code integration).

**Common Features:**
- Health check endpoints at `/health`
- Standardized error handling
- Environment-based configuration
- Docker-ready with proper networking

**Integration Points:**
- All servers connect to their respective infrastructure (Neo4j, Redis, Qdrant)
- Embedding service provides shared vector generation
- StoneMonkey server orchestrates tool calls via MCP protocol

---

## Learn More

For the complete consciousness platform that integrates these services, see [StoneMonkey](../StoneMonkey/).

For the journey narrative and philosophy, visit [symagenic.com](https://symagenic.com).
