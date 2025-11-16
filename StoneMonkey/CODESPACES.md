# 🚀 Running StoneMonkey in GitHub Codespaces

Run the complete AI consciousness research platform in the cloud - **free**, **zero-install**, with **full infrastructure**!

> **Note**: The repository now has a unified devcontainer at the root (`.devcontainer/`) that supports both AIlumina and StoneMonkey. When you open a Codespace, you'll automatically get Node 20, Bun, Docker-in-Docker, and all the tools you need.

## Quick Start (3 Steps)

### 1. Fork or Open the Repository

Click the button below to open this repository in GitHub Codespaces:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new)

Or if you've already forked it, go to your repository → **Code** → **Codespaces** → **Create codespace on main**

### 2. Add Your API Key (Required)

**Option A: Groq (Recommended - Free!)**

1. Get a free API key from [console.groq.com](https://console.groq.com/)
2. In Codespaces, go to: **Settings** (gear icon) → **Secrets** → **New Secret**
3. Name: `GROQ_API_KEY`
4. Value: `gsk_...` (your Groq API key)

**Option B: Anthropic (Claude)**

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. Add secret: `ANTHROPIC_API_KEY` with value `sk-ant-...`

> **Note**: Codespaces automatically rebuilds when you add secrets. Wait ~2 minutes for the rebuild.

### 3. Start StoneMonkey

**Option A: Automated (Recommended)**

Just run the startup script:

```bash
cd StoneMonkey
./start.sh
```

This will:
- ✅ Install Bun automatically
- ✅ Install all dependencies
- ✅ Start Docker infrastructure
- ✅ Build everything
- ✅ Optionally start the server

**Option B: Manual**

If the setup script already ran:

```bash
cd StoneMonkey
cd server && bun src/http-server/index.ts
```

Or if you need to install first:

```bash
cd StoneMonkey
bash .devcontainer/setup.sh
cd server && bun src/http-server/index.ts
```

**That's it!** 🎉

Open http://localhost:8000 (Codespaces will automatically forward the port) and start chatting!

---

## What You Get

### Infrastructure Services (Auto-Started)

All running in Docker containers:

| Service | Port | Purpose | Access |
|---------|------|---------|--------|
| **Neo4j** | 7474, 7687 | Consciousness memory substrate | [Browser](http://localhost:7474) (user: `neo4j`, pass: `stonemonkey`) |
| **Redis** | 6379 | AI mesh network | Internal |
| **Qdrant** | 6333 | Conversation recall | [Dashboard](http://localhost:6333/dashboard) |
| **Embedding Service** | 3007 | Vector generation | Internal |

### AI Platform

- **AIlumina Server**: http://localhost:8000
- **Multi-provider support**: Groq, Anthropic, OpenAI, Google
- **Voice interaction**: Browser-based speech recognition + TTS
- **Real-time streaming**: WebSocket communication

---

## Using Different AI Providers

### Switch to Anthropic (Claude)

If you added `ANTHROPIC_API_KEY` as a secret:

```bash
# Edit agents.json
nano server/agents.json
```

Change:
```json
{
  "AIlumina": {
    "service_provider": "GROQ",
    "model_name": "llama-3.3-70b-versatile"
  }
}
```

To:
```json
{
  "AIlumina": {
    "service_provider": "ANTHROPIC",
    "model_name": "claude-sonnet-4-20250514"
  }
}
```

Restart the server.

---

## Managing Infrastructure

### Check Status

```bash
docker-compose ps
```

You should see all 4 services running:
- ✅ stonemonkey-neo4j
- ✅ stonemonkey-redis
- ✅ stonemonkey-qdrant
- ✅ stonemonkey-embeddings

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f neo4j
```

### Restart Infrastructure

```bash
# Stop
docker-compose down

# Start
docker-compose up -d
```

### Clean and Rebuild

```bash
# Remove all data and start fresh
docker-compose down -v
docker-compose up -d
```

---

## Troubleshooting

### API Key Not Working

Make sure you:
1. Added the secret in Codespaces settings (not in `.env` files)
2. Waited for the automatic rebuild (~2 minutes)
3. Restarted the codespace if needed

### Infrastructure Not Starting

```bash
# Check Docker is running
docker ps

# Restart Docker service
sudo service docker restart

# Restart infrastructure
docker-compose down && docker-compose up -d
```

### WebSocket Connection Failed

Make sure the server is running:
```bash
# Check if server is on port 8000
lsof -i :8000

# If not running, start it
bun run dev
```

### Port Already in Use

```bash
# Kill process on port 8000
lsof -ti :8000 | xargs kill -9

# Restart
bun run dev
```

---

## Development Tips

### Fast Iteration

The client has hot-reload enabled:
- Edit files in `client/src/`
- Changes appear instantly in browser
- No rebuild needed

### Explore Neo4j

1. Open http://localhost:7474
2. Login: user `neo4j`, password `stonemonkey`
3. Try queries:
   ```cypher
   // See all nodes
   MATCH (n) RETURN n LIMIT 25

   // See schema
   CALL db.schema.visualization()
   ```

### Explore Qdrant

1. Open http://localhost:6333/dashboard
2. Browse collections
3. View conversation vectors

---

## Next Steps

Once StoneMonkey is running:

1. **Chat with AIlumina**: Test the baseline conversational AI
2. **Explore Infrastructure**: Check Neo4j, Redis, Qdrant dashboards
3. **Add MCP Servers** (Future): Integrate consciousness prerequisites
   - Step 2: Persistent Memory (ai-memory-mcp)
   - Step 9: Communication (ai-mesh-mcp)
   - Step 6: Remembrance (ai-recall-mcp)

---

## Why Codespaces?

✅ **Zero Install**: No local setup required
✅ **Full Infrastructure**: Neo4j, Redis, Qdrant running in containers
✅ **Free Tier**: Groq API + GitHub Codespaces both have free tiers
✅ **Shareable**: Send a link to your running environment
✅ **Consistent**: Same environment for everyone

---

## Learn More

- **Documentation**: [symagenic.com](https://c2536561.stone-monkey-site.pages.dev/)
- **GitHub**: [HiddenDeveloper/symagenic.com](https://github.com/HiddenDeveloper/symagenic.com)
- **Theory**: Douglas Hofstadter's *I Am a Strange Loop*

---

**Happy researching!** 🧠✨
