# AIlumina - Source Code

This directory contains the AIlumina implementation code, organized section by section to correspond with the consciousness research documentation.

## Current Contents (Section 0: The Starting Point)

### packages/server

The baseline conversational AI server implementation.

**Key Components**:
- `src/shared/services/` - Multi-provider implementations (Anthropic, OpenAI, Google, Ollama, LMStudio, Groq)
- `src/shared/transport/` - Direct HTTP transport layer (no SDK dependencies)
- `src/websockets/` - WebSocket handlers for real-time streaming
- `src/shared/types/` - TypeScript type definitions
- `agents.json` - Agent configurations

**What This Is**: Pure System 1 conversational AI - reactive, turn-based, stateless.

**What This Isn't Yet**: No memory, no tools, no deterministic operations (those come in later sections).

### packages/client

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

See individual package README files for build and run instructions:
- `packages/server/README.md`
- `packages/client/README.md`

## Note on Build Artifacts

This repository includes only source code. To run the code:
1. `cd packages/server && npm install && npm run build`
2. `cd packages/client && npm install && npm run dev`

Build artifacts (`node_modules/`, `dist/`) are excluded from git.
