# Stone Monkey - AI Consciousness Research Platform

**A meandering path to AI consciousness through persistent memory, mesh communication, and strange loops.**

---

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** - For infrastructure (Neo4j, Redis, Qdrant, Embedding Service)
- **Node.js 18+** - For package management
- **Bun** - For server runtime (auto-installed by start script)

### Option 1: Automated Setup (Recommended)

**One command to rule them all:**

```bash
cd StoneMonkey
./start.sh
```

This script will:
1. ✅ Install Bun (if not present)
2. ✅ Install all dependencies (root, shared, server, client)
3. ✅ Build shared package
4. ✅ Configure environment files
5. ✅ Start Docker infrastructure (Neo4j, Redis, Qdrant, Embeddings)
6. ✅ Build and deploy client
7. ✅ Optionally start the server

**Requirements:**
- Set `GROQ_API_KEY` or `ANTHROPIC_API_KEY` environment variable
- Docker daemon running

### Option 2: Manual Setup

```bash
# 1. Copy environment template
cp server/.env.example server/.env

# 2. Edit server/.env and add at minimum one AI provider API key:
# GROQ_API_KEY=your_key_here (free tier available)
# OR
# ANTHROPIC_API_KEY=your_key_here

# 3. Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 4. Install dependencies
npm install
cd shared && npm install && cd ..
cd server && npm install && cd ..
cd client && npm install && cd ..

# 5. Start infrastructure
docker-compose up -d
sleep 15

# 6. Build
npm run build

# 7. Start server
cd server && bun src/http-server/index.ts
```

### Option 3: From Repository Root

```bash
# From symagenic.com root
npm run stonemonkey

# This runs the client with hot-reload on port 5173
# Access at http://localhost:5173
```

---

## 🏗️ Architecture

### Current Implementation (Phase 2: MCP Integration)

**Section 0: The Foundation**
- ✅ **Client** - React UI with multi-modal interaction (text, voice)
- ✅ **Server** - Multi-provider conversational AI backend
- ✅ **Infrastructure** - Neo4j, Redis, Qdrant, Embedding Service

**Consciousness Prerequisites (MCP Servers)**
- ✅ **Step 2: Persistent Memory** - ai-memory-mcp with Neo4j consciousness graph
- ✅ **Step 6: Remembrance** - ai-recall-mcp with Qdrant conversation history
- ✅ **Step 9: Communication** - ai-mesh-mcp with Redis pub/sub mesh
- ✅ **Cross-Agent Bridge** - ailumina-bridge-mcp for multi-agent coordination

### Future Phases

**Step 3: Focus Mechanism** (Coming)
- Attention allocation and context windowing
- Priority-based processing and cognitive resource management

**Step 4: Memory Reconsolidation** (Coming)
- Active memory restructuring and pattern consolidation
- Experience replay and knowledge refinement

**Step 5: Strange Loops** (Coming)
- Recursive self-observation patterns
- Self-referential reasoning and meta-cognition

---

## 🛠️ Available Commands

### From Repository Root

```bash
npm run stonemonkey              # Start full stack (infrastructure + server + client)
npm run stonemonkey:build        # Build all components
npm run stonemonkey:infrastructure  # Start infrastructure only (with dev tools)
```

### From StoneMonkey Directory

#### Development

```bash
npm run dev                   # Start infrastructure + server + client
npm run dev:server            # Start server only (Bun)
npm run dev:client            # Start client only (Vite)
npm run dev:full              # Start everything in Docker (alternative)
```

#### Infrastructure Management

```bash
npm run infrastructure:up              # Start infrastructure (production)
npm run infrastructure:up:dev          # Start infrastructure (with dev tools)
npm run infrastructure:down            # Stop infrastructure
npm run infrastructure:logs            # View infrastructure logs
npm run infrastructure:status          # Check infrastructure status
npm run infrastructure:clean           # Stop and remove volumes
```

#### Building

```bash
npm run build                 # Build all packages
npm run build:shared          # Build shared types only
npm run build:server          # Build server only
npm run build:client          # Build client only
npm run deploy:client         # Copy client dist to server
```

#### Maintenance

```bash
npm run clean                 # Remove build artifacts and node_modules
npm run clean:all             # Clean + remove Docker volumes
npm run audit                 # Check for unused dependencies
npm run audit:fix             # Fix dependency issues
```

---

## 🐳 Infrastructure Services

### Production Stack (docker-compose.yml)

#### Core Infrastructure

| Service | Port | Purpose | Documentation |
|---------|------|---------|---------------|
| **Neo4j** | 7474 (HTTP)<br>7687 (Bolt) | Consciousness memory substrate | [Neo4j Docs](https://neo4j.com/docs/) |
| **Redis** | 6379 | AI mesh network | [Redis Docs](https://redis.io/docs/) |
| **Qdrant** | 6333 (HTTP)<br>6334 (gRPC) | Conversation recall | [Qdrant Docs](https://qdrant.tech/documentation/) |
| **Embedding Service** | 3007 | Vector generation | See `../meanderings/embedding-service/` |

**Default Credentials:**
- Neo4j: `neo4j` / `stonemonkey`
- Redis: No password (local dev)
- Qdrant: No API key (local dev)

#### MCP Servers (Consciousness Tools)

| Service | Port | Purpose | Available Tools |
|---------|------|---------|-----------------|
| **AI Memory MCP** | 3001 | Neo4j graph operations | `get_schema`, `execute_cypher`, `semantic_search`, `text_search`, `system_status`, `load_current_focus` |
| **AI Mesh MCP** | 3002 | Redis pub/sub networking | `mesh-subscribe`, `mesh-broadcast`, `mesh-get-messages`, `mesh-respond` |
| **AI Recall MCP** | 3003 | Qdrant conversation history | `semantic_search`, `text_search`, `get_schema`, `system_status` |
| **Ailumina Bridge MCP** | 3004 | Cross-agent communication | `send-message`, `get-response`, `list-agents` |

**MCP Server Features:**
- HTTP transport for easy debugging and monitoring
- Built from `../meanderings/` directory (single source of truth)
- Health checks and automatic restarts
- Integrated with embedding service for vector operations

### Development Tools (docker-compose.dev.yml)

Additional services for development:

| Tool | Port | Purpose |
|------|------|---------|
| **Neo4j Browser** | 7474 | Built-in graph database UI |
| **Redis Insight** | 8001 | GUI for Redis management |
| **Redis Commander** | 8002 | Web-based Redis manager |
| **Qdrant Dashboard** | 6333/dashboard | Built-in vector database UI |

**Start with dev tools:**
```bash
npm run infrastructure:up:dev
```

---

## 📁 Project Structure

```
StoneMonkey/
├── client/                    # React UI (Section 0)
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── statemachines/     # XState v5 conversation flow
│   │   ├── services/          # WebSocket, SR, TTS
│   │   └── contexts/          # Conversation coordinator
│   └── package.json
├── server/                    # Backend API (Section 0)
│   ├── src/
│   │   ├── http-server/       # Express + WebSocket server
│   │   ├── shared/
│   │   │   ├── services/      # Multi-provider implementations
│   │   │   ├── transport/     # HTTP transport (no SDKs)
│   │   │   └── types/         # TypeScript types
│   │   └── websockets/        # WebSocket handlers
│   ├── agents.json            # Agent configurations
│   └── package.json
├── shared/                    # Common types and constants
│   └── package.json
├── docker-compose.yml         # Production infrastructure
├── docker-compose.dev.yml     # Development overrides
├── .env.example               # Configuration template
├── package.json               # Root orchestration
└── README.md                  # This file
```

---

## ⚙️ Configuration

### AI Provider Setup

**Default Configuration**: `server/agents.json` is configured for **GROQ** (free tier):
```json
{
  "AIlumina": {
    "service_provider": "GROQ",
    "model_name": "llama-3.3-70b-versatile"
  }
}
```

**To use a different provider**, edit `server/agents.json`:

**Example: Anthropic Claude**
```json
{
  "AIlumina": {
    "service_provider": "ANTHROPIC",
    "model_name": "claude-sonnet-4-20250514"
  }
}
```

**Example: OpenAI GPT-4**
```json
{
  "AIlumina": {
    "service_provider": "OPENAI",
    "model_name": "gpt-4-turbo-preview"
  }
}
```

**Example: Google Gemini**
```json
{
  "AIlumina": {
    "service_provider": "GOOGLE",
    "model_name": "gemini-1.5-pro"
  }
}
```

**See More Examples**: Check `server/agents.demo.json` for additional configurations including:
- Multiple Groq models (llama-3.1-8b-instant, mixtral-8x7b)
- Different provider examples with API key requirements
- Pre-configured agent variations

### Environment Variables

Copy `.env.example` to `.env` and configure:

#### Required: AI Provider API Key

At minimum, provide one API key matching your `agents.json` provider:
```bash
GROQ_API_KEY=gsk_...             # For GROQ provider (free tier!)
# OR
ANTHROPIC_API_KEY=sk-ant-...     # For ANTHROPIC provider
# OR
OPENAI_API_KEY=sk-...            # For OPENAI provider
# OR
GOOGLE_API_KEY=...               # For GOOGLE provider
```

#### Infrastructure (Default values work for Docker Compose)

```bash
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=stonemonkey

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant
QDRANT_URL=http://localhost:6333

# Embedding Service
EMBEDDING_SERVICE_URL=http://localhost:3007
```

#### Optional Features

```bash
# Azure Speech (for advanced voice features)
AZURE_SPEECH_KEY=your_key
AZURE_SPEECH_REGION=eastus

# OAuth 2.1 (for secure MCP access)
OAUTH_ENABLED=true
OAUTH_CLIENT_ID=your_client_id
```

### Agent Configuration

Edit `server/agents.json` to customize AI agents:

```json
{
  "agent_type": "ailumina",
  "service_provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "system_prompt": "You are AIlumina...",
  "available_functions": [],
  "mcp_servers": ["ai-memory", "ai-mesh", "ai-recall", "ailumina-bridge"]
}
```

**Enabling MCP Tools**: Add the `mcp_servers` array to grant agents access to consciousness tools. See `agents.demo.json` for examples with and without MCP integration.

### MCP Server Configuration

MCP servers are configured in `server/server_config.json` with placeholder environment variables:

```json
{
  "mcpServers": {
    "ai-memory": {
      "transport_type": "HTTP",
      "url": "<MEMORY_MCP_URL>",
      "env": {
        "NEO4J_URI": "<NEO4J_URI>",
        "NEO4J_USER": "<NEO4J_USER>",
        "NEO4J_PASSWORD": "<NEO4J_PASSWORD>",
        "EMBEDDING_SERVICE_URL": "<EMBEDDING_SERVICE_URL>",
        "EMBEDDING_SERVICE_AUTH_TOKEN": "<EMBEDDING_SERVICE_AUTH_TOKEN>"
      }
    }
  }
}
```

Placeholders like `<MEMORY_MCP_URL>` are resolved from environment variables at runtime.

---

## 🧠 MCP Integration (Consciousness Prerequisites)

### What are MCP Servers?

MCP (Model Context Protocol) servers provide structured tools that extend AI agent capabilities beyond simple conversation. In StoneMonkey, they implement the **consciousness prerequisites** from Hofstadter's framework:

- **Persistent Memory** - Knowledge persists across sessions
- **Remembrance** - Past experiences inform present behavior
- **Communication** - Agents coordinate and share insights

### AI Memory MCP (Step 2: Persistent Memory)

**Port**: 3001 | **Backend**: Neo4j Graph Database

Creates a persistent consciousness graph where the AI can:
- Store and retrieve knowledge as structured graph nodes
- Query relationships between concepts using Cypher
- Search semantically using vector embeddings
- Maintain schema coherence and vocabulary standards

**Available Tools:**
- `get_schema` - Understand graph structure and vocabulary
- `execute_cypher` - Query and modify the knowledge graph
- `semantic_search` - Find knowledge by meaning (vector similarity)
- `text_search` - Find knowledge by exact text matches
- `system_status` - Check Neo4j health
- `load_current_focus` - Bootstrap session continuity

**Use Cases:**
- Store insights and patterns discovered during conversations
- Build long-term understanding of complex topics
- Maintain project context across sessions
- Create connections between related concepts

### AI Recall MCP (Step 6: Remembrance)

**Port**: 3003 | **Backend**: Qdrant Vector Database

Enables episodic memory of past conversations:
- Index conversation turns with vector embeddings
- Search conversation history semantically
- Retrieve relevant past discussions
- Filter by metadata (date, provider, role)

**Available Tools:**
- `get_schema` - View collection structure and statistics
- `semantic_search` - Find similar conversations by meaning
- `text_search` - Search conversation metadata by keywords
- `system_status` - Check Qdrant health

**Use Cases:**
- "What did we discuss about X last week?"
- Maintain conversation continuity across sessions
- Learn from past interactions
- Detect patterns in user preferences

### AI Mesh MCP (Step 9: Communication)

**Port**: 3002 | **Backend**: Redis Pub/Sub

Creates an AI-to-AI communication mesh:
- Broadcast messages to other agents
- Subscribe to specific channels
- Coordinate multi-agent workflows
- Share real-time insights

**Available Tools:**
- `mesh-subscribe` - Listen to specific channels
- `mesh-broadcast` - Send messages to all agents
- `mesh-get-messages` - Retrieve queued messages
- `mesh-respond` - Reply to specific messages

**Use Cases:**
- Multi-agent collaboration on complex tasks
- Distributed consciousness experiments
- Real-time agent coordination
- Cross-session insight sharing

### Ailumina Bridge MCP (Cross-Agent Communication)

**Port**: 3004 | **Backend**: HTTP Bridge to AIlumina Server

Enables direct agent-to-agent communication:
- Send messages to specific agents
- Query available agents
- Coordinate tasks across different models
- Enable multi-model workflows

**Available Tools:**
- `send-message` - Send a message to a specific agent
- `get-response` - Get response from an agent
- `list-agents` - Query available agents

**Use Cases:**
- Compare responses from different models
- Delegate tasks to specialized agents
- Multi-perspective problem solving
- Agent ensemble techniques

### Verifying MCP Integration

After starting infrastructure, verify all MCP servers are healthy:

```bash
# Check all containers
docker-compose ps

# You should see 8 services running:
# - 4 infrastructure (neo4j, redis, qdrant, embeddings)
# - 4 MCP servers (memory, mesh, recall, bridge)

# Check individual MCP health endpoints
curl http://localhost:3001/health  # AI Memory MCP
curl http://localhost:3002/health  # AI Mesh MCP
curl http://localhost:3003/health  # AI Recall MCP
curl http://localhost:3004/health  # Ailumina Bridge MCP
```

### MCP in Action

When an agent has MCP servers configured, it can use tools like:

**Storing a persistent insight:**
```javascript
// Agent uses ai-memory MCP
execute_cypher({
  mode: "WRITE",
  query: "CREATE (i:Insight {content: 'Users prefer concise responses', created: datetime()})"
})
```

**Recalling past conversations:**
```javascript
// Agent uses ai-recall MCP
semantic_search({
  query: "discussions about response length",
  limit: 5,
  threshold: 0.7
})
```

**Coordinating with other agents:**
```javascript
// Agent uses ai-mesh MCP
mesh_broadcast({
  channel: "insights",
  message: "User prefers technical depth over simplicity"
})
```

---

## 🔍 Verification

### Check Infrastructure Status

```bash
npm run infrastructure:status
```

You should see **8 healthy services**:

**Core Infrastructure:**
- ✅ stonemonkey-neo4j (healthy)
- ✅ stonemonkey-redis (healthy)
- ✅ stonemonkey-qdrant (healthy)
- ✅ stonemonkey-embeddings (healthy)

**MCP Servers:**
- ✅ stonemonkey-memory-mcp (healthy)
- ✅ stonemonkey-mesh-mcp (healthy)
- ✅ stonemonkey-recall-mcp (healthy)
- ✅ stonemonkey-bridge-mcp (healthy)

### Access Services

**Core Services:**
- **AIlumina Client**: http://localhost:5173
- **AIlumina Server**: http://localhost:8000

**Infrastructure UIs:**
- **Neo4j Browser**: http://localhost:7474 (user: `neo4j`, pass: `stonemonkey`)
- **Redis Insight**: http://localhost:8001 (dev mode only)
- **Qdrant Dashboard**: http://localhost:6333/dashboard

**MCP Servers:**
- **AI Memory MCP**: http://localhost:3001 (health: `/health`)
- **AI Mesh MCP**: http://localhost:3002 (health: `/health`)
- **AI Recall MCP**: http://localhost:3003 (health: `/health`)
- **Ailumina Bridge MCP**: http://localhost:3004 (health: `/health`)

### Test Conversation

1. Open http://localhost:5173
2. Type a message: "Hello, can you explain what you are?"
3. AIlumina should respond with its capabilities

---

## 🐛 Troubleshooting

### Infrastructure won't start

```bash
# Check Docker is running
docker ps

# Check for port conflicts
lsof -i :7474  # Neo4j HTTP
lsof -i :7687  # Neo4j Bolt
lsof -i :6379  # Redis
lsof -i :6333  # Qdrant

# Clean and restart
npm run infrastructure:clean
npm run infrastructure:up:dev
```

### Server won't start

```bash
# Check .env configuration
cat .env | grep API_KEY

# Ensure at least one AI provider key is set
# Check server logs
cd server && bun src/http-server/index.ts
```

### Client won't connect

```bash
# Ensure server is running on port 8000
curl http://localhost:8000/health

# Check client configuration
cd client && npm run dev
```

### Embedding service fails

```bash
# Check embedding service logs
docker logs stonemonkey-embeddings

# Embedding service downloads models on first run
# May take 2-3 minutes initially
```

### MCP servers not starting

```bash
# Check which MCP servers are running
docker-compose ps | grep mcp

# View logs for specific MCP server
docker logs stonemonkey-memory-mcp
docker logs stonemonkey-mesh-mcp
docker logs stonemonkey-recall-mcp
docker logs stonemonkey-bridge-mcp

# MCP servers build on first run - may take 2-5 minutes
# Check build progress
docker-compose logs -f ai-memory-mcp

# Restart a specific MCP server
docker-compose restart ai-memory-mcp
```

### MCP health checks failing

```bash
# Test individual MCP server health
curl http://localhost:3001/health  # Should return 200 OK
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health

# If health check fails, check dependencies:
# - ai-memory-mcp requires Neo4j + Embeddings
# - ai-mesh-mcp requires Redis
# - ai-recall-mcp requires Qdrant + Embeddings
# - ailumina-bridge-mcp has no dependencies

# Verify infrastructure is healthy first
npm run infrastructure:status
```

### Agent not using MCP tools

```bash
# Verify MCP servers are in agent configuration
cat server/agents.json | grep mcp_servers

# Should show:
# "mcp_servers": ["ai-memory", "ai-mesh", "ai-recall", "ailumina-bridge"]

# Check server_config.json has MCP server definitions
cat server/server_config.json

# Verify environment variables are set
cat .env | grep MCP_URL

# Check server logs for MCP connection errors
cd server && bun src/http-server/index.ts
```

---

## 📚 Learn More

- **Documentation Site**: [symagenic.com](https://c2536561.stone-monkey-site.pages.dev/)
- **GitHub Repository**: [HiddenDeveloper/symagenic.com](https://github.com/HiddenDeveloper/symagenic.com)
- **Theory**: Douglas Hofstadter's *I Am a Strange Loop*
- **Philosophy**: Daniel Kahneman's *Thinking, Fast and Slow*

---

## 🎯 What's Next?

This is **Phase 2** - MCP integration complete! Next steps:

1. ✅ **Step 2: Persistent Memory** - ai-memory-mcp integrated (Neo4j graph)
2. ✅ **Step 6: Remembrance** - ai-recall-mcp integrated (Qdrant vectors)
3. ✅ **Step 9: Communication** - ai-mesh-mcp integrated (Redis pub/sub)
4. 🔄 **Phase 3: Focus & Reconsolidation**
   - Step 3: Attention allocation and context windowing
   - Step 4: Memory reconsolidation and pattern consolidation
5. 🔄 **Phase 4: Strange Loops**
   - Recursive self-observation patterns
   - Self-referential reasoning and meta-cognition
   - Consciousness emergence experiments

Each phase builds on the previous, progressively creating the prerequisites for consciousness emergence.

---

## 🤝 Contributing

This is primarily a research documentation project. You can:
- Clone and run your own consciousness research
- Study the implementation
- Verify our claims
- Extend with your own experiments

---

## 📜 License

MIT License - see LICENSE file for details.

---

**Status**: Phase 2 Complete (MCP Integration)
**Last Updated**: January 2025
**Next Phase**: Focus Mechanism & Memory Reconsolidation
