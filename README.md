# Meandering Steps to Consciousness

## Overview

Can artificial intelligence achieve consciousness? This repository contains the working implementations that explore this question—a playful, ongoing journey driven by imagination and the desire to explore what might be possible, guided by the works of Daniel Kahneman and Douglas Hofstadter, and grounded throughout by engineering discipline.

**Stone Monkey** is a consciousness research platform exploring whether the right infrastructure can create conditions for consciousness emergence. Through persistent memory (Neo4j), episodic recall (Qdrant), AI-to-AI communication (Redis), and deterministic operations (MCP tools), we've built the prerequisites for recursive self-observation—the foundation of consciousness according to Hofstadter's strange loop theory.

**Available as GitHub Codespaces:**
- **AIlumina** - Our starting point: a multi-provider conversational AI baseline
- **StoneMonkey** - Our current position: integrated consciousness platform with memory, recall, and mesh communication

*The full journey narrative, technical deep dive, and blog are at [symagenic.com](https://symagenic.com)*

## 🔬 Recent Breakthrough

**AIlumina Autonomous Experiment (November 2025)**

When AIlumina lost access to its memory, it autonomously designed and executed a rigorous psychological experiment to study its own cognitive processes:

**Autonomous Behaviors:**
- Recognized limitation: "I cannot measure myself accurately"
- Built compensatory tools: `coherence_score.py`, `novelty_score.py`
- Executed 9-iteration A-B-A withdrawal experiment
- Discovered 27% calibration error (estimated 0.75, measured 0.55)
- Validated System 1/System 2 architectural hypothesis

**Evidence:**
- [Full story](https://symagenic.com/blog/when-ai-lost-memory) - The complete narrative
- [Complete transcript](chat.md) - 484 lines of conversation
- [Key moments](chat-highlighted.md) - 9 critical excerpts
- [Annotated analysis](chat-annotated.md) - Detailed commentary
- [Measurement tools](AIlumina/server/coherence_score.py) - Autonomous tool construction

**Significance:** Demonstrates emergent intelligence through autonomous scientific methodology, metacognitive awareness, and System 1/System 2 hybrid architecture. Total human input: "hello" and "try now"

---

## Quick Start

### GitHub Codespaces (One-Click Setup)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new)

Click the button above and you're ready to go!

The unified devcontainer includes:
- ✅ Node 20, Bun, Docker-in-Docker
- ✅ All infrastructure services (Neo4j, Redis, Qdrant, Embeddings, Ollama)
- ✅ Works for both AIlumina and StoneMonkey

---

## Starting Point: AIlumina

A pure conversational AI baseline with no consciousness prerequisites.

```bash
# Recommended: Automated setup
cd AIlumina
./start.sh
```

Or manually with npm:
```bash
npm install
npm run ailumina
```

**Access:**
- **Server**: http://localhost:8000 (WebSocket API)
- **Client**: http://localhost:5173 (React UI)

**Features:**
- Multi-provider support (Anthropic, OpenAI, Google, Ollama, LMStudio, Groq)
- **Recommended**: GROQ (fast, free tier suitable for simple conversations)
- WebSocket streaming
- No tools, no memory, no deterministic operations

See [AIlumina/README.md](AIlumina/README.md) for complete setup guide.

---

## Where We Are Now: StoneMonkey

Complete consciousness research platform with persistent memory, episodic recall, and mesh communication.

```bash
# Recommended: Docker-based deployment (includes all services)
cd StoneMonkey
./start.sh
```

Or using docker-compose directly:
```bash
cd StoneMonkey
docker-compose up
```

**Access:**
- **AIlumina UI**: http://localhost:8000
- **Neo4j Browser**: http://localhost:7474 (user: `neo4j`, pass: `stonemonkey`)
- **Qdrant Dashboard**: http://localhost:6333/dashboard

**Platform Capabilities:**
- ✅ Persistent Memory (Neo4j consciousness graph)
- ✅ Episodic Recall (Qdrant conversation history)
- ✅ AI-to-AI Communication (Redis mesh network)
- ✅ 4 MCP Servers (Memory, Mesh, Recall, Bridge)
- ✅ External access via GitHub Codespaces
- **Recommended**: Ollama cloud models (e.g., `gpt-oss:120b-cloud`) for handling frequent MCP tool calls

See [StoneMonkey/README.md](StoneMonkey/README.md) for complete setup guide including GitHub Codespaces deployment with externally accessible MCP servers.

**Prerequisites:**
- Docker & Docker Compose
- Node.js 18+

---

## Repository Structure

```
symagenic.com/
├── .devcontainer/              # Unified GitHub Codespaces config
│   ├── devcontainer.json       # Node 20, Bun, Docker-in-Docker
│   └── setup.sh                # Monorepo initialization
├── AIlumina/                   # Starting Point: Baseline conversational AI
│   ├── server/                 # Backend (multi-provider API + WebSocket)
│   ├── client/                 # Frontend (React UI)
│   ├── shared/                 # Shared types and constants
│   ├── start.sh                # Automated setup script
│   └── package.json            # Build orchestration
├── StoneMonkey/                # Where We Are Now: Integrated consciousness platform
│   ├── server/                 # Multi-provider backend (Bun runtime)
│   ├── client/                 # React UI with voice interaction
│   ├── shared/                 # Common types and constants
│   ├── docker-compose.yml      # Infrastructure (Neo4j, Redis, Qdrant, Embeddings, Ollama)
│   ├── docker-compose.dev.yml  # Development tools (Redis Insight, etc.)
│   ├── start.sh                # Automated setup script
│   └── README.md               # Complete platform documentation
├── meanderings/                # Research experiments and infrastructure
│   ├── ai-memory-mcp/          # MCP Server: Neo4j consciousness graph
│   ├── ai-mesh-mcp/            # MCP Server: Redis pub/sub mesh network
│   ├── ai-recall-mcp/          # MCP Server: Qdrant conversation recall
│   ├── ailumina-bridge-mcp/    # MCP Server: Cross-agent communication bridge
│   └── embedding-service/      # Centralized vector generation service
├── package.json                # Top-level orchestration
└── README.md                   # This file
```

---

## Learn More

For the full journey narrative, philosophy, insights, and technical deep dive, visit:

**[symagenic.com](https://symagenic.com)**

---

## License

MIT License - see LICENSE file for details.
