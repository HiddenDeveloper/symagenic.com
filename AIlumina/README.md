# AIlumina - Source Code

This directory contains the AIlumina implementation code, organized section by section to correspond with the consciousness research documentation.

## Current Contents (Section 0: The Starting Point)

### server

The baseline conversational AI server implementation.

**Key Components**:
- `src/shared/services/` - Multi-provider implementations (Anthropic, OpenAI, Google, Ollama, LMStudio, Groq)
- `src/shared/transport/` - Direct HTTP transport layer (no SDK dependencies)
- `src/websockets/` - WebSocket handlers for real-time streaming
- `src/shared/types/` - TypeScript type definitions
- `agents.json` - Agent configurations

**What This Is**: Pure System 1 conversational AI - reactive, turn-based, stateless.

**What This Isn't Yet**: No memory, no tools, no deterministic operations (those come in later sections).

### client

The web UI for interacting with AIlumina.

**Key Components**:
- `src/components/` - React UI components
- `src/machines/` - XState state machines for conversation flow
- `src/services/` - WebSocket client service

## Code Organization by Section

This repository is being built section by section, each adding the code that implements that section's consciousness prerequisite:

- **Section 0** ← Current: Server + Client (baseline conversational AI)
- **Section 1** (Coming): Tool system and MCP integration
- **Section 2** (Coming): Memory MCP server (Neo4j)
- **Section 3** (Coming): Strange loop formation code
- **Section 4** (Coming): Schema evolution automation
- **Section 5** (Coming): Focus mechanism
- **Section 6** (Coming): Domain separation (Strava/Discord skills)
- **Section 7** (Coming): Mesh MCP server (Redis)

## Building and Running

### Quick Start (Development)

From the AIlumina directory:

```bash
# Install dependencies
npm install

# Start development servers (client + server)
npm run dev
```

Server: http://localhost:8000
Client: http://localhost:5173

### Configuration

**Required**: Copy `server/.env.example` to `server/.env` and configure:
- At minimum, provide one AI provider API key (Anthropic, OpenAI, Google, Groq, or Ollama/LMStudio URL)

**Optional Features**:
- **Voice Mode/TTS**: Requires Azure Cognitive Services Speech configuration
  - Uncomment and configure `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in `.env`
  - Without this, text-only chat works perfectly - voice features just won't be available

### Production Build

```bash
# Build everything (shared, server, client)
npm run build

# Start production server
npm start
```

The client build is automatically deployed to `server/dist/client` for serving.

### Individual Package Commands

See individual package README files for detailed instructions:
- `server/README.md` - Backend API and WebSocket server
- `client/README.md` - React frontend
- `shared/README.md` - Shared types and constants

### Build Scripts

- `npm run build` - Build all packages and deploy client
- `npm run build:shared` - Build shared package only
- `npm run build:server` - Build server only
- `npm run build:client` - Build client only
- `npm run deploy:client` - Copy client dist to server
- `npm run dev` - Run both servers in dev mode
- `npm run clean` - Remove all build artifacts

## Note on Build Artifacts

Build artifacts (`node_modules/`, `dist/`) are excluded from git.
