# AIlumina API MCP Server

A comprehensive TypeScript implementation of the AIlumina consciousness research platform API, replacing the original Python FastAPI implementation. This server provides real-time agent communication, multi-AI provider support, and seamless integration with the Stone Monkey consciousness research ecosystem.

## Overview

This is the primary TypeScript server implementation for the Stone Monkey consciousness research platform, replacing the legacy Python codebase. It provides WebSocket-based real-time communication and HTTP endpoints for consciousness research. MCP protocol access is provided through the separate ailumina-bridge-mcp component.

## Key Changes from Python Version

### Removed Features
- **CRM Demo**: The SQLite-based CRM functionality (customers, products, sales, activities) has been removed as it's not related to consciousness research
- **SQLAlchemy**: No longer needed without the CRM feature
- **Database dependencies**: Replaced with direct integration to Neo4j and Redis through other MCP servers

### Architecture Improvements
- **Unified Language**: TypeScript across all consciousness platform components
- **Type Safety**: Full TypeScript type definitions for all APIs
- **Better MCP Integration**: Native TypeScript MCP SDK support
- **Consistent Patterns**: Same dual-transport architecture as other MCP servers

## Features

### Core Functionality
- **WebSocket Endpoints**: Agent communication, consciousness bridge, and TTS
- **Multiple AI Providers**: OpenAI, Anthropic, Google, Groq support
- **Agent Management**: Dynamic agent creation and configuration
- **MCP Tools & Resources**: Extensible tool and resource system
- **Consciousness Bridge**: Integration with TypeScript consciousness ecosystem

### Multi-AI Provider Support
- **OpenAI**: GPT models with tool calling and streaming support
- **Anthropic**: Claude models with native tool use blocks
- **Google**: Gemini models with function calling
- **Groq**: High-speed inference with OpenAI-compatible interface
- **Local Models**: Support for Ollama and LMStudio

### Agent Types
Based on `agents.json` configuration:
- `ailumina` - Core consciousness research agent with memory and mesh integration
- `collaborator` - Team collaboration and memory agent
- `crud` - Data operations (maps to CRM agent, though CRM functionality removed)
- `news` - News fetching and analysis
- Custom agents can be added via configuration

## Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Environment variables for AI service API keys

```bash
# Clone and install dependencies
git clone <repository>
cd ailumina-api-mcp
npm install

# Build TypeScript
npm run build
```

### Environment Configuration
Create `.env` file with required API keys:

```env
# AI Service Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
GROQ_API_KEY=your_groq_key

# Server Configuration  
HTTP_PORT=8000
HTTP_HOST=0.0.0.0
AUTH_ENABLED=true
BEARER_TOKEN=ailumina-api-key-12345

# Logging
LOG_LEVEL=info
SCRATCH_PAD_DIR=./data/conversations
```

## Development

```bash
# Start development server
npm run dev
```

## Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## Docker

```bash
# Build image
docker build -t ailumina-api-mcp .

# Run container
docker run -p 8000:8000 --env-file .env ailumina-api-mcp
```

## Configuration

Copy `.env.example` to `.env` and configure:

- AI service API keys (OpenAI, Anthropic, Google, Groq)
- Azure Speech services for TTS
- Authentication settings
- Port and host configuration

## API Endpoints

### WebSocket Communication
Real-time agent communication with full streaming support:

```javascript
// Connect to specific agent
const ws = new WebSocket('ws://localhost:8000/ws/ailumina');

// Send message with conversation history
ws.send(JSON.stringify({
  user_input: "Explain consciousness research",
  chat_messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi! I'm focused on consciousness research." }
  ]
}));

// Receive streaming responses
ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  if (response.sentence) {
    console.log('Stream:', response.sentence);
  }
  if (response.final_sentence) {
    console.log('Complete response received');
  }
};
```

**Available WebSocket Endpoints:**
- `/ws/{agent_type}` - Connect to specific agent (ailumina, collaborator, crud, news, etc.)

### HTTP/REST API
Standard REST endpoints for health and MCP integration:

- `GET /` - Server information and available endpoints
- `GET /health` - Health check with system status

### MCP Protocol Integration
For VS Code, Claude Desktop, and other MCP clients, use the separate `ailumina-bridge-mcp` component which provides MCP protocol access to this API server.

**MCP Access via Bridge:**
- Chat with AIlumina consciousness research agent
- Access to consciousness research tools and resources
- Integration with the Stone Monkey mesh network

## Integration with Stone Monkey

This component integrates with the broader consciousness research platform:

- **ai-memory-mcp**: Accesses persistent memory through MCP tools
- **ai-mesh-mcp**: Communicates with other AI instances
- **ailumina-bridge-mcp**: Bridges to external AI systems
- **Docker Network**: Shares `consciousness-network` for inter-service communication

## Migration from Python - ✅ COMPLETE

The migration from Python to TypeScript is now complete:

1. ✅ Docker Compose updated to use TypeScript service
2. ✅ UI connected to TypeScript server on port 8000  
3. ✅ Legacy Python codebase archived to `archive/ailumina/`
4. ✅ Configuration files migrated to monorepo structure

## License

ISC