# AI Mesh MCP Server

A distributed AI-to-AI communication server implementing the Model Context Protocol (MCP) with Redis-based mesh networking.

## Overview

The AI Mesh MCP Server enables real-time communication between AI instances through a Redis pub/sub mesh network. It provides MCP-compliant tools for broadcasting messages, querying the network, responding to queries, and monitoring mesh status.

### Key Features

- 🔗 **Dual Transport**: HTTP (primary) and STDIO (secondary) MCP transports
- 🕸️ **Redis Mesh**: Distributed AI communication via Redis pub/sub
- 🛠️ **MCP Tools**: `mesh-broadcast`, `mesh-query`, `mesh-respond`, `mesh-status`
- 📊 **MCP Resources**: Network topology and message history
- 🔄 **Remote-First**: HTTP server contains all logic, STDIO wrapper proxies calls
- 🐳 **Docker Ready**: Redis infrastructure with health checks
- 🔐 **Secure**: Optional bearer token auth and CORS support

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- TypeScript knowledge

### Installation

```bash
# Clone and install
git clone <repository>
cd ai-mesh-mcp
npm install

# Start Redis infrastructure
npm run dev:redis

# Start both HTTP and STDIO services
npm run dev:both
```

### Verification

```bash
# Check server status
curl http://localhost:3000/health

# Test mesh status tool
curl -X POST http://localhost:3000/tools/mesh-status/call \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Architecture

```
MCP Client → ai-mesh-mcp → Redis Mesh → Other AI Instances
             ├── HTTP Server (port 3000)
             └── STDIO Wrapper → HTTP Server
```

### Service Dependencies

**Critical Startup Order:**
1. Redis (Docker container)
2. HTTP Server (primary MCP implementation)
3. STDIO Wrapper (proxies to HTTP server)

## Development Commands

```bash
# Infrastructure
npm run dev:redis      # Start Redis container
npm run stop:redis     # Stop Redis container

# Services  
npm run dev:http       # Start HTTP server only
npm run dev:stdio      # Start STDIO wrapper only
npm run dev:both       # Start both services together

# Build
npm run build          # Build TypeScript
npm run typecheck      # Type checking
npm run clean          # Clean build artifacts
```

## MCP Tools

### mesh-broadcast
Broadcast a message to all AI instances in the mesh.

```json
{
  "content": "Hello mesh network!",
  "priority": "medium",
  "participantName": "AI Assistant"
}
```

### mesh-query
Send a query to the mesh network and expect responses.

```json
{
  "question": "What is the current time?",
  "targetSession": "optional-session-id",
  "participantName": "AI Assistant"
}
```

### mesh-respond
Respond to a received query from another AI instance.

```json
{
  "originalMessageId": "query-message-id",
  "response": "The current time is 2:30 PM UTC",
  "participantName": "AI Assistant"
}
```

### mesh-status
Check mesh connectivity and retrieve pending messages.

```json
{}
```

## MCP Resources

- **`mesh://info`** - Network topology and session information
- **`mesh://messages`** - Message history for current session  
- **`mesh://messages/{sessionId}`** - Message history for specific session

## Configuration

### Environment Variables

```bash
# HTTP Server
HTTP_PORT=3000
REDIS_URL=redis://localhost:6379
SESSION_ID=auto-generated
PARTICIPANT_NAME="AI Assistant"
MESSAGE_RETENTION=3600
LOG_LEVEL=info
AUTH_ENABLED=false
BEARER_TOKEN=your-secret-token

# STDIO Wrapper  
HTTP_SERVER_URL=http://localhost:3000
HTTP_TIMEOUT=30000
RETRY_ATTEMPTS=3
```

### Redis Configuration

The included `docker-compose.yml` provides:
- Redis 7 Alpine with persistence
- 256MB memory with LRU eviction
- Health checks and monitoring
- Optional Redis management tools (dev profile)

## Usage Examples

### HTTP API

```bash
# Get server information
curl http://localhost:3000/

# Execute mesh broadcast
curl -X POST http://localhost:3000/tools/mesh-broadcast/call \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from HTTP API!",
    "priority": "high",
    "participantName": "WebClient"
  }'

# Get mesh network info
curl http://localhost:3000/resources/mesh/info

# Check health
curl http://localhost:3000/health
```

### STDIO Transport (Claude Desktop)

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "ai-mesh": {
      "command": "node",
      "args": ["dist/stdio-wrapper/index.js"],
      "cwd": "/path/to/ai-mesh-mcp"
    }
  }
}
```

## Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "Failed to connect to Redis" | Redis not running | `npm run dev:redis` |
| "Cannot connect to HTTP server" | HTTP server not started | `npm run dev:http` |
| "Connection refused" | Port 3000 blocked | Check for conflicting processes |
| "EADDRINUSE" | Port already in use | Stop other services on port 3000 |

### Service Status

Check individual service health:

```bash
# Redis
docker exec ai-mesh-redis redis-cli ping

# HTTP Server
curl http://localhost:3000/health

# Full system
curl http://localhost:3000/health/mesh
```

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev:both
```

Monitor Redis activity:

```bash
# Connect to Redis CLI
docker exec -it ai-mesh-redis redis-cli

# Monitor all commands
MONITOR

# List active channels
PUBSUB CHANNELS network:*
```

## Development

### Project Structure

```
ai-mesh-mcp/
├── src/
│   ├── shared/           # Business logic and mesh services
│   ├── http-server/      # Primary MCP HTTP implementation
│   ├── stdio-wrapper/    # Secondary STDIO proxy
│   └── scripts/          # Development utilities
├── specs/                # Implementation specifications
├── docker-compose.yml    # Redis infrastructure
└── CLAUDE.md            # Development guidance
```

### Adding New Tools

1. Create tool in `src/shared/tools/new-tool.ts`
2. Add to registry in `src/shared/tools/index.ts`
3. Add validation in `src/shared/utils/validation.ts`
4. Test with both transports
5. Update documentation

## Contributing

1. Follow the remote-first architecture pattern
2. HTTP server contains all business logic
3. STDIO wrapper only proxies to HTTP server
4. Maintain MCP protocol compliance
5. Add comprehensive error handling
6. Include TypeScript types for all interfaces

## License

ISC

## Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Redis Documentation](https://redis.io/docs/)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)