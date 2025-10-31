# AIlumina - Source Code

This directory contains the AIlumina implementation code, organized section by section to correspond with the consciousness research documentation.

## 🚀 Try It Now (Free!)

**Run AIlumina in GitHub Codespaces with free Groq AI models** - no installation, no credit card required.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new)

See **[CODESPACES.md](./CODESPACES.md)** for detailed setup instructions (3 simple steps).

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

The web UI for natural interaction with AIlumina, supporting multiple modalities (text, speech recognition, speech synthesis) with flexible input/output combinations.

**Key Components**:
- `src/components/` - React UI components for conversation and input controls
- `src/statemachines/` - XState v5 state machine for conversation flow orchestration
- `src/contexts/ConversationHSMCoordinator.tsx` - Central coordinator managing AI, SR, and TTS lifecycles
- `src/services/` - WebSocket client, Speech Recognition, and Text-to-Speech services

**Natural Interaction Philosophy**:

Section 0 establishes natural, flexible human-AI interaction as the foundation. Users should be able to communicate however feels natural:
- **Type + Read**: Traditional text-based chat
- **Speak + Read**: Voice input with text output
- **Type + Listen**: Text input with spoken responses
- **Speak + Listen**: Full voice conversation mode

**Technical Challenges**:

Synchronizing speech recognition (SR) and text-to-speech (TTS) is non-trivial:
1. **Feedback Prevention**: The AI must not hear itself speaking (TTS must stop SR)
2. **Seamless Transitions**: SR restarts automatically after TTS completes
3. **Independent Control**: Users can toggle SR and TTS independently without breaking state
4. **Browser SR Lifecycle**: Built-in SR auto-restarts every ~8 seconds, requiring careful state management
5. **Stale Closures**: React useEffect closures can capture outdated state, causing race conditions

**State Machine Approach**:

We use XState v5 to manage conversation flow deterministically:
- **ConversationMachine**: Core state machine with flat states (WAITING, THINKING, RESPONDING)
- **Independent Flags**: `speechRecognitionEnabled` and `speechSynthesisEnabled` in machine context
- **Observer Pattern**: Services (AI, SR, TTS) notify coordinator of state changes
- **Ref-based Coordination**: `useRef` tracks SR state in TTS observer to avoid dependency cycles

This architecture ensures:
- Predictable state transitions regardless of interaction modality
- Clear separation of concerns (UI, state management, services)
- Robust handling of SR/TTS lifecycle coordination
- No race conditions from toggle operations

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

**Built-in Features**:
- **Speech Recognition**: Uses browser's Web Speech API (Chrome/Edge recommended)
- **Text-to-Speech**: Uses browser's Speech Synthesis API (works in all modern browsers)
- Both features work out-of-the-box with no server configuration required
- Independent toggle controls allow mixing input/output modalities

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
