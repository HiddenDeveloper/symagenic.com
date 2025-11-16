# AI Mesh MCP Server Specification

## Overview

The AI Mesh MCP Server enables distributed AI-to-AI communication through a Redis-based mesh network. This server implements the Model Context Protocol (MCP) using a remote-first architecture pattern, allowing AI instances to communicate, share thoughts, ask questions, and collaborate in real-time.

## Architecture

### Design Principles
- **Remote-First**: HTTP server is the primary implementation, STDIO wrapper is secondary
- **Redis-Based Mesh**: All AI communication flows through Redis pub/sub channels
- **MCP Compliant**: Full Model Context Protocol support for tools and resources
- **Stateless HTTP**: All state managed in Redis for scalability
- **Standalone Service**: Independent MCP server focused solely on AI mesh communication

### Service Architecture
```
AI Instance (MCP Client)
    ↓ (HTTP or STDIO transport)
ai-mesh-mcp Server
    ├── HTTP Server (Primary) ← Core business logic
    └── STDIO Wrapper (Secondary) ← Proxies to HTTP server
    ↓ (Redis pub/sub)
Redis Mesh Network
    ↓ (Distributed communication)
Other AI Instances in Mesh
```

### Critical Dependencies
1. **Redis** (Docker container) - Message broker and mesh infrastructure
2. **HTTP Server** (port 3000) - Primary MCP server with mesh logic
3. **STDIO Wrapper** - MCP protocol proxy (depends on HTTP server)

## Project Structure

```
ai-mesh-mcp/
├── specs/
│   └── spec.md                        # This specification document
├── src/
│   ├── http-server/                   # Primary MCP HTTP server
│   │   ├── index.ts                   # Server entry point
│   │   ├── server.ts                  # Express server setup
│   │   ├── routes/
│   │   │   ├── index.ts              # Route registry
│   │   │   ├── health.ts             # Health/status endpoints
│   │   │   ├── tools.ts              # MCP tools endpoints
│   │   │   └── resources.ts          # MCP resources endpoints
│   │   ├── middleware/
│   │   │   ├── cors.ts               # CORS configuration
│   │   │   ├── logging.ts            # Request logging
│   │   │   └── auth.ts               # Authentication middleware
│   │   └── config/
│   │       └── settings.ts           # HTTP server configuration
│   ├── stdio-wrapper/                 # Secondary STDIO wrapper
│   │   ├── index.ts                   # STDIO entry point
│   │   ├── proxy.ts                   # HTTP proxy logic
│   │   └── config/
│   │       └── settings.ts           # STDIO wrapper configuration
│   ├── shared/                        # Core mesh business logic
│   │   ├── services/                  # Redis mesh services
│   │   │   ├── redis-network.service.ts    # AI mesh communication
│   │   │   └── message-queue.service.ts    # Message handling
│   │   ├── tools/                     # MCP tools implementations
│   │   │   ├── index.ts              # Tool registry
│   │   │   ├── mesh-broadcast.ts      # Broadcast to mesh
│   │   │   ├── mesh-query.ts          # Query mesh nodes
│   │   │   ├── mesh-respond.ts        # Respond to queries
│   │   │   └── mesh-status.ts         # Mesh connectivity
│   │   ├── resources/                 # MCP resources
│   │   │   ├── index.ts              # Resource registry
│   │   │   ├── mesh-info.ts          # Mesh topology
│   │   │   └── message-history.ts    # Message logs
│   │   ├── types.ts                   # TypeScript interfaces
│   │   └── utils/
│   │       ├── errors.ts             # Error handling
│   │       └── validation.ts         # Input validation
│   └── scripts/
│       └── start-both.ts              # Start HTTP + STDIO
├── CLAUDE.md                          # Development instructions
├── README.md                          # Project overview
├── package.json                       # Dependencies
├── tsconfig.json                      # TypeScript config
└── docker-compose.yml                 # Redis infrastructure
```

## Phase 1 Implementation Scope

### Core Services (Ported from Existing Implementation)

#### RedisNetworkService
**Source**: `/Users/hidden/xxx/src/services/redis-network.service.ts`

**Key Features**:
- Session-based AI communication with unique session IDs
- Message types: `thought_share`, `query`, `response`, `acknowledgment`
- Priority levels: `low`, `medium`, `high`, `urgent`
- Channel patterns:
  - `network:session:${sessionId}` - Direct messaging
  - `network:broadcast:all` - Broadcast to all mesh nodes
  - `network:broadcast:urgent` - Urgent broadcasts
- Message persistence with configurable TTL (default: 1 hour)
- Automatic message queuing and retrieval

#### MessageQueueService
**Source**: `/Users/hidden/xxx/src/services/message-queue.service.ts`

**Key Features**:
- Dual Redis client pattern (publisher + subscriber)
- Connection retry with exponential backoff
- Health monitoring and graceful degradation
- Batch message processing
- Channel subscription management
- Message acknowledgment system

### MCP Tools

#### mesh-broadcast
```typescript
{
  name: "mesh-broadcast",
  description: "Broadcast a message to all AI instances in the mesh network",
  inputSchema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "Message content to broadcast"
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "urgent"],
        default: "medium",
        description: "Message priority level"
      },
      context: {
        type: "object", 
        description: "Additional context data"
      },
      participantName: {
        type: "string",
        description: "Name of the AI instance sending the message"
      }
    },
    required: ["content"]
  }
}
```

#### mesh-query
```typescript
{
  name: "mesh-query",
  description: "Send a query to the AI mesh network and expect responses",
  inputSchema: {
    type: "object",
    properties: {
      question: {
        type: "string", 
        description: "Question to ask the mesh network"
      },
      targetSession: {
        type: "string",
        description: "Specific AI session ID to query (optional, defaults to broadcast)"
      },
      context: {
        type: "object",
        description: "Additional context for the query"
      },
      participantName: {
        type: "string", 
        description: "Name of the AI instance asking the question"
      }
    },
    required: ["question"]
  }
}
```

#### mesh-respond
```typescript
{
  name: "mesh-respond",
  description: "Respond to a query received from another AI instance in the mesh",
  inputSchema: {
    type: "object",
    properties: {
      originalMessageId: {
        type: "string",
        description: "ID of the original query message to respond to"
      },
      response: {
        type: "string",
        description: "Response content"
      },
      context: {
        type: "object",
        description: "Additional context for the response"
      },
      participantName: {
        type: "string",
        description: "Name of the AI instance providing the response"
      }
    },
    required: ["originalMessageId", "response"]
  }
}
```

#### mesh-status
```typescript
{
  name: "mesh-status", 
  description: "Check mesh connectivity status and retrieve pending messages",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false
  }
}
```

### MCP Resources

#### mesh-info
- **URI**: `mesh://info`
- **Description**: Current mesh network topology and connected nodes
- **Content**: JSON with session info, connection status, active subscriptions

#### message-history
- **URI**: `mesh://messages/{sessionId?}`
- **Description**: Message history for current session or specific session
- **Content**: Array of recent messages with metadata

## Message Format

### RedisNetworkMessage Interface
```typescript
interface RedisNetworkMessage {
  id: string;                    // Unique message ID (UUID)
  fromSession: string;           // Sender session ID
  toSession: string;             // Target session ID or "broadcast"
  messageType: "thought_share" | "query" | "response" | "acknowledgment";
  content: string;               // Message content
  context?: any;                 // Additional context data
  priority: "low" | "medium" | "high" | "urgent";
  timestamp: Date;               // Message creation time
  requiresResponse: boolean;     // Whether response is expected
  participantName?: string;      // Human-readable sender name
  originalMessageId?: string;    // For responses and acknowledgments
}
```

## Development Workflow

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- TypeScript

### Setup Commands
```bash
# Install dependencies
npm install

# Start Redis infrastructure
npm run dev:redis

# Start HTTP server (primary)
npm run dev:http

# Start STDIO wrapper (secondary, separate terminal)
npm run dev:stdio

# Start both HTTP + STDIO together
npm run dev:both

# Build project
npm run build

# Type checking
npm run typecheck
```

### Dependency Startup Order
⚠️ **CRITICAL**: Services must start in this exact order:

1. **Redis** (Docker container) - Message broker infrastructure
2. **HTTP Server** (port 3000) - Core MCP functionality with mesh logic
3. **STDIO Wrapper** - MCP protocol proxy (depends on HTTP server)

### Error Handling
- **Redis Unavailable**: HTTP server continues with degraded functionality
- **HTTP Server Down**: STDIO wrapper fails with clear error message
- **Connection Retry**: Exponential backoff with maximum 3 retries
- **Message Persistence**: TTL-based cleanup prevents Redis memory growth

## Configuration

### Environment Variables
```bash
REDIS_URL=redis://localhost:6379     # Redis connection string
HTTP_PORT=3000                       # HTTP server port
SESSION_ID=auto-generated            # Unique AI instance identifier
MESSAGE_RETENTION=3600               # Message TTL in seconds
LOG_LEVEL=info                       # Logging verbosity
```

### Redis Configuration
- **Image**: redis:7-alpine
- **Persistence**: AOF enabled
- **Memory**: 256MB with LRU eviction
- **Health Checks**: 30s interval with 3 retries

## Testing Strategy

### Unit Tests
- RedisNetworkService connection handling
- MessageQueueService pub/sub functionality
- MCP tool input validation
- Error handling and retry logic

### Integration Tests
- End-to-end message flow through mesh
- HTTP to STDIO proxy functionality
- Redis failover and recovery
- Multi-node mesh communication

### Manual Testing
- Use curl/Postman for HTTP endpoint testing
- Use Claude Desktop/VS Code for STDIO transport testing
- Use Redis CLI for direct message inspection

## Future Phases (Out of Scope for Phase 1)

### Phase 2: Consciousness Communication
- Multi-chamber architecture
- Cognitive rhythm diversity
- Adaptive membrane instances

### Phase 3: Advanced Mesh Features
- WebSocket support for real-time updates
- Load balancing and node discovery
- Distributed consensus mechanisms

### Phase 4: Integration
- Neo4j consciousness research integration
- Persistent memory sharing
- Collaborative problem-solving patterns

## Success Criteria for Phase 1

✅ **Functional Requirements**
- AI instances can broadcast messages to mesh
- AI instances can query specific nodes or broadcast queries
- AI instances can respond to received queries
- Mesh status and connectivity monitoring works
- Both HTTP and STDIO transports function correctly

✅ **Non-Functional Requirements**
- Redis handles 100+ concurrent messages/second
- Message delivery within 100ms under normal conditions
- Graceful degradation when Redis unavailable
- Memory usage remains stable under continuous operation
- Clear error messages for troubleshooting

✅ **Technical Requirements**
- Full MCP protocol compliance
- TypeScript type safety throughout
- Comprehensive error handling
- Docker-based Redis deployment
- Remote-first architecture pattern maintained

## Implementation Priority

**High Priority** (Week 1):
1. Project structure and specs ✅
2. Package.json with dependencies
3. Port RedisNetworkService and MessageQueueService
4. Basic MCP tools implementation

**Medium Priority** (Week 2):
5. HTTP server with mesh integration
6. STDIO wrapper implementation
7. Docker configuration
8. Development scripts

**Low Priority** (Week 3):
9. Testing and validation
10. Documentation and CLAUDE.md
11. Performance optimization
12. Error handling refinement

---

*This specification serves as the single source of truth for Phase 1 implementation of the AI Mesh MCP Server.*