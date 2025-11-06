# Ailumina Bridge MCP Server

MCP server that provides bridge functionality to the Ailumina AI platform. Enables MCP clients to interact with Ailumina's hierarchical agent system through WebSocket communication.

## Features

### Core Bridge Functionality
- **Ailumina Chat Integration**: Direct communication with Ailumina agent hierarchy
- **WebSocket Bridge**: Real-time bidirectional communication with Ailumina platform
- **Agent Type Support**: Connect to different Ailumina agents (crud, news, collaborator, ailumina)
- **Conversation History**: Maintains context across chat sessions
- **Standard MCP Protocol**: Full compliance with MCP specification

### Available Tools
- **echo**: Echo back provided text
- **calculate**: Perform basic arithmetic calculations
- **get_time**: Get current server time in various formats
- **ailumina_status**: Get server status and health info
- **ailumina_chat**: Bridge to Ailumina agent system with full conversation support

### Available Resources
- **ailumina://status**: Server health and runtime information
- **ailumina://info**: Server capabilities and configuration
- **ailumina://tools**: List of all available tools

## Installation

```bash
npm install
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```


## Architecture

```
src/
├── shared/              # Shared types and utilities
│   ├── types.ts         # TypeScript type definitions  
│   ├── utils.ts         # Common utility functions
│   └── websocket-client.ts # WebSocket client for Ailumina communication
├── server/              # MCP Server implementation
│   ├── server.ts        # Main server class
│   ├── tools.ts         # Tool definitions and handlers (including ailumina_chat)
│   └── resources.ts     # Resource definitions and handlers
└── index.ts             # Main entry point
```

## Integration with Ailumina Platform

This bridge server provides:

1. **Direct Communication**: WebSocket bridge to Ailumina's agent hierarchy
2. **MCP Compliance**: Works with any MCP client (Claude Desktop, VS Code, etc.)
3. **Agent Access**: Connect to specialized Ailumina agents (crud, news, collaborator, ailumina)
4. **Context Preservation**: Maintains conversation history across interactions
5. **Real-time Communication**: Bidirectional WebSocket communication with Ailumina

## Development

```bash
# Type checking
npm run typecheck

# Build
npm run build

# Clean
npm run clean
```

## Example Usage

### Using ailumina_chat Tool

The `ailumina_chat` tool connects to your Ailumina server to process messages:

```json
{
  "tool": "ailumina_chat",
  "parameters": {
    "agent_type": "ailumina",
    "user_input": "Hello, how can you help me today?",
    "chat_messages": [
      {"role": "user", "content": "Previous question"},
      {"role": "assistant", "content": "Previous response"}
    ],
    "server_url": "ws://localhost:8000"
  }
}
```

### MCP Client Integration

Add to your MCP client configuration (e.g., Claude Desktop, VS Code):

```json
{
  "servers": {
    "ailumina-bridge": {
      "type": "stdio",
      "command": "node",
      "args": ["path/to/ailumina-bridge/dist/index.js"]
    }
  }
}
```

## Requirements

- Node.js 18+ 
- Running Ailumina server (default: ws://localhost:8000)
- MCP client (Claude Desktop, VS Code with MCP extension, etc.)

## Bridge Architecture

This server acts as a bridge between the MCP ecosystem and Ailumina's self-evolving AI platform:

```
MCP Client (Claude Desktop/VS Code) 
        ↓ (STDIO/MCP Protocol)
Ailumina Bridge MCP Server
        ↓ (WebSocket)
Ailumina Platform → Agent Hierarchy
```

The bridge enables MCP clients to access Ailumina's:
- Dynamic tool creation capabilities
- Hierarchical agent delegation  
- Persistent memory and context
- Multi-modal AI interactions
- Self-evolution features