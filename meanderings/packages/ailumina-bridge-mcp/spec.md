# Ailumina Simple MCP - Technical Specification

## Overview

Ailumina Simple MCP is a Model Context Protocol (MCP) server that provides a bridge between MCP clients and the Ailumina AI agent system via WebSocket communication. This implementation allows any MCP-compatible client to interact with Ailumina's conversational AI agents.

## Architecture

### High-Level Architecture

```plaintext
┌─────────────────┐    MCP Protocol     ┌──────────────────┐    WebSocket     ┌─────────────────┐
│   MCP Client    │◄──────STDIO────────►│ Ailumina Simple  │◄────TCP/8000────►│ Ailumina Server │
│ (Claude Desktop │                     │   MCP Server     │                  │   (FastAPI)     │
│  VS Code, etc.) │                     │                  │                  │                 │
└─────────────────┘                     └──────────────────┘                  └─────────────────┘
```

### Component Breakdown

1. **MCP Server Core** (`src/server/server.ts`)
   - Implements MCP JSON-RPC protocol over STDIO
   - Handles tool registration and execution
   - Manages resource definitions

2. **WebSocket Client** (`src/shared/websocket-client.ts`)
   - Connects to Ailumina WebSocket endpoints
   - Handles real-time message streaming
   - Processes different message types (sentence, tool_running, complete, etc.)

3. **Tool Registry** (`src/server/tools.ts`)
   - Defines available MCP tools
   - Includes the core `ailumina_chat` tool
   - Handles parameter validation and execution

## Core Tool: ailumina_chat

### Purpose

The `ailumina_chat` tool serves as a bridge between MCP clients and Ailumina AI agents, enabling seamless conversation capabilities.

### Tool Definition

```typescript
{
  name: 'ailumina_chat',
  description: 'Send a message to the Ailumina agent system and get a response. IMPORTANT: To maintain conversation context, you MUST include the complete conversation history in chat_messages for each call after the first one.',
  parameters: {
    type: 'object',
    properties: {
      agent_type: {
        type: 'string',
        description: 'Type of Ailumina agent to communicate with',
        enum: ['crud', 'news', 'collaborator', 'ailumina']
      },
      user_input: {
        type: 'string',
        description: 'The message to send to the agent'
      },
      chat_messages: {
        type: 'array',
        description: 'CRITICAL: Complete conversation history to maintain context between calls. For first message, use empty array []. For subsequent messages, include ALL previous exchanges in chronological order with exact format: [{"role": "user", "content": "user message"}, {"role": "assistant", "content": "ai response"}, ...]. This enables the agent to remember previous context and provide coherent responses.',
        items: {
          type: 'object',
          properties: {
            role: { 
              type: 'string',
              description: 'Message role: "user" for human messages, "assistant" for AI responses'
            },
            content: { 
              type: 'string',
              description: 'The actual message content'
            }
          },
          required: ['role', 'content']
        }
      },
      fileId: {
        type: 'string',
        description: 'Optional file ID for file upload context'
      },
      server_url: {
        type: 'string',
        description: 'Ailumina server WebSocket URL (optional, defaults to ws://localhost:8000)'
      }
    },
    required: ['agent_type', 'user_input']
  }
}
```

### Supported Agent Types

1. **crud** - Database and CRUD operations agent
2. **news** - News and information retrieval agent  
3. **collaborator** - Collaborative task management agent
4. **ailumina** - General purpose Ailumina agent (mapped to 'AIlumina' endpoint)

## WebSocket Communication Protocol

### Connection Flow

1. **Connection Establishment**

   ```typescript
   const url = `ws://localhost:8000/ws/${agentType}`;
   const ws = new WebSocket(url, { headers });
   ```

2. **Message Sending**

   ```json
   {
     "user_input": "Hello, how can you help me?",
     "chat_messages": [
       {"role": "user", "content": "Previous message"},
       {"role": "assistant", "content": "Previous response"}
     ],
     "fileId": "optional-file-id"
   }
   ```

3. **Response Processing**
   The server processes multiple message types during a conversation:

### Message Types

#### Sentence Messages

```json
{
  "type": "sentence",
  "sentence": "Partial response text..."
}
```

- **Purpose**: Streaming AI response content
- **Handling**: Accumulated into final response

#### Tool Execution Messages

```json
{
  "type": "tool_running",
  "tool_name": "calculator"
}
```

```json
{
  "type": "tool_complete", 
  "tool_name": "calculator"
}
```

- **Purpose**: Indicate tool execution status
- **Handling**: Logged for debugging, not included in final response

#### Completion Message

```json
{
  "type": "complete"
}
```

- **Purpose**: Signals end of conversation
- **Handling**: Returns accumulated response to MCP client

#### Error Messages

```json
{
  "type": "error",
  "error": "Error description"
}
```

- **Purpose**: Communicate errors from Ailumina
- **Handling**: Propagated as MCP tool execution error

#### Chat Messages

```json
{
  "role": "assistant",
  "content": "Full response text",
  "parts": [{"text": "Response part"}]
}
```

- **Purpose**: Complete conversation messages
- **Handling**: Content extracted and accumulated

## MCP Protocol Implementation

### Initialization

```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  }
}
```

### Tool Listing

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "params": {}
}
```

### Tool Execution

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "ailumina_chat",
    "arguments": {
      "agent_type": "ailumina",
      "user_input": "Hello!",
      "chat_messages": []
    }
  }
}
```

## Error Handling

### Connection Errors

- **Timeout**: 30-second default timeout for WebSocket connections
- **Connection Refused**: Proper error propagation when Ailumina server unavailable
- **Invalid Agent Type**: Validation before attempting connection

### Protocol Errors

- **Malformed Messages**: JSON parsing error handling
- **Missing Parameters**: Parameter validation with descriptive errors
- **WebSocket Failures**: Connection state management and cleanup

### Example Error Response

```json
{
  "success": false,
  "error": "Ailumina chat failed: Connection timeout after 30000ms"
}
```

## Configuration

### Default Configuration

```typescript
const DEFAULT_WEBSOCKET_OPTIONS = {
  serverUrl: 'ws://localhost:8000',
  timeout: 30000,
  retries: 3
};
```

### Environment Variables

- `AILUMINA_WS_URL`: Override default WebSocket URL
- `AILUMINA_WS_TIMEOUT`: Override connection timeout

## Conversation Continuity

### Critical Requirements for Context Management

The `ailumina_chat` tool is **stateless** - each call is independent. To maintain conversation context, MCP clients MUST manually track and pass conversation history:

#### First Message (New Conversation)

```json
{
  "tool": "ailumina_chat",
  "parameters": {
    "agent_type": "ailumina",
    "user_input": "My name is John",
    "chat_messages": []
  }
}
```

#### Follow-up Messages (Conversation Continues)

```json
{
  "tool": "ailumina_chat",
  "parameters": {
    "agent_type": "ailumina", 
    "user_input": "What's my name?",
    "chat_messages": [
      {"role": "user", "content": "My name is John"},
      {"role": "assistant", "content": "Hello John! Nice to meet you. How can I help you today?"}
    ]
  }
}
```

#### Conversation Pattern

```plaintext
Call 1: chat_messages: [] → Response: "Hello John!"
Call 2: chat_messages: [{"role":"user","content":"My name is John"},{"role":"assistant","content":"Hello John!"}] 
Call 3: chat_messages: [previous + new exchange] 
...and so on
```

**Why This Matters**: Without proper chat_messages, the Ailumina agent cannot remember previous context and will treat each interaction as a new conversation.

## Usage Examples

### Basic Usage (First Message)

```json
{
  "tool": "ailumina_chat",
  "parameters": {
    "agent_type": "ailumina",
    "user_input": "What is the weather like today?",
    "chat_messages": []
  }
}
```

### Continuing Conversation

```json
{
  "tool": "ailumina_chat", 
  "parameters": {
    "agent_type": "collaborator",
    "user_input": "Can you help me with that task?",
    "chat_messages": [
      {"role": "user", "content": "I need to organize my project"},
      {"role": "assistant", "content": "I can help you organize your project. What specific areas need attention?"}
    ]
  }
}
```

### With File Context

```json
{
  "tool": "ailumina_chat",
  "parameters": {
    "agent_type": "crud",
    "user_input": "Analyze this uploaded file",
    "fileId": "file_123abc",
    "server_url": "ws://custom-server:8000"
  }
}
```

## Testing Strategy

### Unit Testing

- Parameter validation testing
- WebSocket connection mocking
- Message type handling verification

### Integration Testing

- End-to-end MCP protocol communication
- WebSocket connection with mock Ailumina server
- Error scenario testing

### Manual Testing

```bash
# Start MCP server
npm run dev:server

# Test via STDIO (requires MCP client)
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | npm run dev:server
```

## Performance Considerations

### Connection Management

- Single WebSocket connection per tool call
- Automatic connection cleanup after response
- Configurable timeout to prevent hanging connections

### Memory Usage

- Streaming response accumulation
- Limited message history storage
- Proper garbage collection of WebSocket instances

### Scalability

- Stateless design supports multiple concurrent requests
- No persistent connections maintained
- Resource cleanup after each tool execution

## Security Considerations

### Input Validation

- Agent type enumeration enforcement
- Parameter type validation
- JSON schema validation

### Network Security

- WebSocket connection over trusted networks
- Optional SSL/TLS support (wss://)
- Origin header validation

### Error Information

- Sanitized error messages
- No sensitive information leakage
- Structured error reporting

## Deployment

### Production Deployment

```bash
npm run build
npm start -- --mode=server
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["npm", "start", "--", "--mode=server"]
```

### MCP Client Configuration

```json
{
  "mcpServers": {
    "ailumina-simple": {
      "command": "node",
      "args": ["/path/to/ailumina-simple/dist/index.js", "--mode=server"]
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify Ailumina server is running on port 8000
   - Check network connectivity
   - Validate WebSocket URL configuration

2. **Tool Not Found**
   - Ensure MCP server is properly initialized
   - Verify tool registration in tools.ts
   - Check MCP client tool list response

3. **Timeout Errors**
   - Increase timeout configuration
   - Check Ailumina server responsiveness
   - Verify WebSocket connection stability

### Debug Logging

```bash
DEBUG=ailumina:* npm run dev:server
```

## Future Enhancements

### Planned Features

- Connection pooling for better performance
- Caching layer for repeated requests
- Support for additional message types
- Enhanced error recovery mechanisms

### Extension Points

- Custom agent type registration
- Pluggable message processors
- Configurable response transformers
- Advanced connection management

## API Reference

### WebSocket Client API

#### AiluminaWebSocketClient

```typescript
class AiluminaWebSocketClient {
  constructor(options?: WebSocketClientOptions)
  async connect(agentType: string): Promise<void>
  async sendChatMessage(message: AiluminaMessage): Promise<string>
  disconnect(): void
  get connected(): boolean
}
```

#### Utility Functions

```typescript
async function executeAiluminaChat(
  agentType: string,
  userInput: string, 
  chatMessages?: any[],
  fileId?: string,
  options?: WebSocketClientOptions
): Promise<string>
```

### MCP Tool API

```typescript
async function executeTool(name: string, parameters: Record<string, any>): Promise<ExecutionResult>
```

#### Result Types

```typescript
interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}
```
