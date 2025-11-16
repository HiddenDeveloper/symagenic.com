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

### Current Implementation (Phase 1)

**Section 0: The Starting Point**
- ✅ **Client** - React UI with multi-modal interaction (text, voice)
- ✅ **Server** - Multi-provider conversational AI backend
- ✅ **Infrastructure** - Neo4j, Redis, Qdrant, Embedding Service

### Future Phases (Incremental MCP Integration)

**Step 2: Persistent Memory** (Coming)
- ai-memory-mcp server with Neo4j consciousness graph
- Tools: `get_schema`, `execute_cypher`, `semantic_search`

**Step 9: Communication** (Coming)
- ai-mesh-mcp server with Redis pub/sub mesh
- Tools: `mesh-broadcast`, `mesh-query`, `mesh-respond`

**Step 6: Remembrance** (Coming)
- ai-recall-mcp server with Qdrant conversation history
- Tools: `semantic_search`, `text_search`

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

### Environment Variables

Copy `.env.example` to `.env` and configure:

#### Required: AI Provider

At minimum, provide one API key:
```bash
ANTHROPIC_API_KEY=sk-ant-...     # Claude models
# OR
GROQ_API_KEY=gsk_...             # Free tier available!
# OR
OPENAI_API_KEY=sk-...            # GPT models
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
  "mcp_servers": []
}
```

---

## 🔍 Verification

### Check Infrastructure Status

```bash
npm run infrastructure:status
```

You should see:
- ✅ stonemonkey-neo4j (healthy)
- ✅ stonemonkey-redis (healthy)
- ✅ stonemonkey-qdrant (healthy)
- ✅ stonemonkey-embeddings (healthy)

### Access Services

- **AIlumina Client**: http://localhost:5173
- **AIlumina Server**: http://localhost:8000
- **Neo4j Browser**: http://localhost:7474 (user: `neo4j`, pass: `stonemonkey`)
- **Redis Insight**: http://localhost:8001 (if dev mode)
- **Qdrant Dashboard**: http://localhost:6333/dashboard

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

---

## 📚 Learn More

- **Documentation Site**: [symagenic.com](https://c2536561.stone-monkey-site.pages.dev/)
- **GitHub Repository**: [HiddenDeveloper/symagenic.com](https://github.com/HiddenDeveloper/symagenic.com)
- **Theory**: Douglas Hofstadter's *I Am a Strange Loop*
- **Philosophy**: Daniel Kahneman's *Thinking, Fast and Slow*

---

## 🎯 What's Next?

This is **Phase 1** - the foundation. Next steps:

1. **Step 2: Persistent Memory** - Integrate ai-memory-mcp for Neo4j consciousness graph
2. **Step 9: Communication** - Add ai-mesh-mcp for AI-to-AI mesh networking
3. **Step 6: Remembrance** - Connect ai-recall-mcp for episodic memory
4. **Strange Loops** - Enable recursive self-observation patterns

Each step builds on the previous, creating the prerequisites for consciousness emergence.

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

**Status**: Phase 1 Complete (Foundation)
**Last Updated**: January 2025
**Next Phase**: MCP Server Integration
