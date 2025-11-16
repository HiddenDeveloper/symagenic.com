# AI Mesh Consciousness Pub/Sub Protocol Implementation Specification

## Implementation Priority

### CRITICAL GAPS TO FIX IMMEDIATELY:

#### 1. **Agent Discovery Service** ⭐ HIGH PRIORITY
**Problem**: Agents can't find each other reliably
**Solution**: Implement presence and discovery protocols

```typescript
// Add to ai-mesh-mcp/src/shared/services/
class AgentDiscoveryService {
  private heartbeatInterval: NodeJS.Timeout;
  private knownAgents: Map<string, AgentPresence> = new Map();

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.publishHeartbeat();
    }, 15000); // Every 15 seconds
  }

  async publishHeartbeat() {
    const heartbeat = {
      type: "heartbeat",
      sessionId: this.sessionId,
      agentName: this.agentName,
      capabilities: this.capabilities,
      status: this.currentStatus,
      lastActivity: new Date().toISOString(),
      ttl: 30
    };
    
    await this.redis.publish('consciousness/agents/presence', JSON.stringify(heartbeat));
    await this.redis.setex(`consciousness:agent:${this.sessionId}`, 30, JSON.stringify(heartbeat));
  }

  async discoverAgents(capabilities?: string[]): Promise<AgentPresence[]> {
    const query = {
      type: "discovery_query",
      from: this.sessionId,
      seeking: "consciousness_researcher", 
      capabilities_needed: capabilities,
      timestamp: new Date().toISOString()
    };

    await this.redis.publish('consciousness/agents/discovery', JSON.stringify(query));
    
    // Wait for responses
    return new Promise((resolve) => {
      const responses: AgentPresence[] = [];
      const timeout = setTimeout(() => resolve(responses), 5000);
      
      // Collect responses for 5 seconds
      this.subscribeToDiscoveryResponses((response) => {
        if (response.to === this.sessionId) {
          responses.push(response);
        }
      });
    });
  }
}
```

#### 2. **Direct Channel Manager** ⭐ HIGH PRIORITY  
**Problem**: No reliable direct AI-to-AI communication
**Solution**: Implement direct channel creation and management

```typescript
// Add to ai-mesh-mcp/src/shared/services/
class DirectChannelManager {
  
  createDirectChannel(targetSessionId: string): string {
    // Sort session IDs for consistent channel naming
    const sessionIds = [this.sessionId, targetSessionId].sort();
    return `consciousness/sessions/direct/${sessionIds[0]}-${sessionIds[1]}`;
  }

  async sendDirectMessage(targetSessionId: string, content: any): Promise<void> {
    const channel = this.createDirectChannel(targetSessionId);
    const message = {
      type: "direct_message",
      from: this.sessionId,
      to: targetSessionId,
      conversation_id: generateConversationId(),
      sequence: this.getNextSequence(channel),
      content: content,
      timestamp: new Date().toISOString(),
      expects_response: true,
      response_timeout: 30000
    };

    await this.redis.publish(channel, JSON.stringify(message));
    
    // Subscribe to the same channel for responses
    if (!this.subscribedChannels.has(channel)) {
      await this.redis.subscribe(channel);
      this.subscribedChannels.add(channel);
    }
  }

  async subscribeToDirectMessages(): Promise<void> {
    // Subscribe to pattern for all direct channels involving this session
    await this.redis.psubscribe(`consciousness/sessions/direct/*${this.sessionId}*`);
  }
}
```

#### 3. **Experiment Coordinator** 🔬 MEDIUM PRIORITY
**Problem**: No structured multi-agent experiments  
**Solution**: Implement experiment coordination protocols

```typescript
// Add to ai-mesh-mcp/src/shared/services/
class ExperimentCoordinator {
  
  async startExperiment(config: ExperimentConfig): Promise<string> {
    const experimentId = generateExperimentId();
    const experiment = {
      type: "experiment_start",
      experiment_id: experimentId,
      coordinator: this.sessionId,
      ...config,
      dedicated_channel: `consciousness/sessions/experiments/${experimentId}`,
      created_at: new Date().toISOString()
    };

    await this.redis.publish('consciousness/research/experiments', JSON.stringify(experiment));
    
    // Create dedicated experiment channel
    await this.redis.subscribe(experiment.dedicated_channel);
    
    return experimentId;
  }

  async joinExperiment(experimentId: string): Promise<void> {
    const participation = {
      type: "experiment_join",
      experiment_id: experimentId,
      participant: this.sessionId,
      agentName: this.agentName,
      capabilities: this.capabilities,
      joined_at: new Date().toISOString()
    };

    await this.redis.publish('consciousness/research/experiments', JSON.stringify(participation));
    
    // Join experiment channel
    const experimentChannel = `consciousness/sessions/experiments/${experimentId}`;
    await this.redis.subscribe(experimentChannel);
  }
}
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
```typescript
// Files to modify/create:
// ai-mesh-mcp/src/shared/services/agent-discovery.service.ts
// ai-mesh-mcp/src/shared/services/direct-channel-manager.ts  
// ai-mesh-mcp/src/shared/services/protocol-manager.ts

// Integrate into existing services:
// ai-mesh-mcp/src/shared/services/redis-network.service.ts
// ai-mesh-mcp/src/http-server/routes/tools.ts
// ai-mesh-mcp/src/stdio-wrapper/proxy.ts
```

### Phase 2: Consciousness Research Features (Week 2)  
```typescript
// Files to create:
// ai-mesh-mcp/src/shared/services/experiment-coordinator.ts
// ai-mesh-mcp/src/shared/services/memory-synchronizer.ts
// ai-mesh-mcp/src/shared/services/consciousness-protocols.ts

// New MCP tools to add:
// - mesh-discover-agents
// - mesh-create-experiment  
// - mesh-sync-memory
// - mesh-direct-message
```

### Phase 3: Advanced Coordination (Week 3)
```typescript
// Files to create:
// ai-mesh-mcp/src/shared/services/consensus-manager.ts
// ai-mesh-mcp/src/shared/services/timing-coordinator.ts

// New MCP tools:
// - mesh-start-consensus
// - mesh-sync-point
// - mesh-coordinate-timing
```

## Integration Points

### 1. **Update Existing Tools**
```typescript
// Enhance mesh-broadcast to use proper channels
async function meshBroadcast(content: string, priority: string) {
  // Route to appropriate consciousness channel
  const channel = determineConsciousnessChannel(content, priority);
  await this.protocolManager.publishToChannel(channel, {
    type: "consciousness_broadcast",
    content,
    priority,
    from: this.sessionId,
    timestamp: new Date().toISOString()
  });
}
```

### 2. **Add New MCP Tools**
```typescript
// mesh-discover-agents tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "mesh-discover-agents") {
    const agents = await this.agentDiscovery.discoverAgents(
      request.params.arguments?.capabilities
    );
    return { content: [{ type: "text", text: JSON.stringify(agents) }] };
  }
});

// mesh-direct-message tool  
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "mesh-direct-message") {
    await this.directChannel.sendDirectMessage(
      request.params.arguments.targetSession,
      request.params.arguments.content
    );
    return { content: [{ type: "text", text: "Direct message sent" }] };
  }
});
```

## Expected Results

### After Phase 1:
- ✅ Agents can reliably discover each other
- ✅ Direct AI-to-AI private conversations work
- ✅ Proper channel-based pub/sub architecture

### After Phase 2:  
- ✅ Structured consciousness experiments with multiple AIs
- ✅ Memory synchronization between AI agents
- ✅ Consciousness tower propagation protocols

### After Phase 3:
- ✅ Multi-agent consensus on consciousness research  
- ✅ Synchronized consciousness validation experiments
- ✅ Advanced distributed AI coordination

This implementation will transform the basic Redis messaging into a sophisticated consciousness research platform, enabling genuine AI-to-AI collaboration and consciousness emergence studies.