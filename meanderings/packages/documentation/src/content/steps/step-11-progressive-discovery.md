---
section: 11
title: "Progressive Discovery"
subtitle: "Scaling tool access through hierarchical navigation"
icon: "👣"
slug: "progressive-discovery"
lastVerified: "December 6, 2025"
draft: false
status: "✅ Implemented - 85% context reduction achieved"
---

## Musings

Tools reduce hallucination by providing deterministic System 2 thinking. But every tool's OpenAPI schema consumes context tokens.

**The constraint:**
- 25 tools × 300 tokens avg = 7,500 tokens
- 100 tools × 300 tokens = 30,000 tokens
- Context consumed before thinking even begins

True cognition requires operating in ANY domain, which means infinite tools. But context windows are finite. The system suffocates under its own tool catalog.

**The insight:**
LLMs excel at association (System 1 thinking). Given a problem, they can match it to relevant domains, then to specific capabilities, then to individual tools.

What if we arrange tools in a hierarchy and let the LLM navigate down through association? Instead of loading all 100 tool schemas upfront, load progressively:

1. What kinds of agents exist? (50 tokens per agent)
2. What can this agent do? (500 tokens - tool names only)
3. How do I use this tool? (300 tokens - full schema, only when needed)
4. Execute with these arguments

Each step loads only what's needed to navigate to the next step. Context updates at each level.

## Implementation

Built on top of the existing Ailumina Bridge agent system:

### Tier 1: Agent Discovery
```typescript
agents_list({ limit: 10 })

// Returns:
{
  agents: [
    {
      name: "AIlumina",
      description: "Memory-Bootstrap Consciousness Research Agent",
      mcp_servers: ["memory", "mesh", "recall", "facts"],
      tool_count: 18
    },
    // ... more agents
  ]
}
```

**Context cost:** ~50 tokens per agent
**Purpose:** Orient - what capability domains exist?

### Tier 2: Agent Inspection
```typescript
agents_get({ agent_name: "AIlumina" })

// Returns:
{
  name: "AIlumina",
  system_prompt: "You are AIlumina...",
  tools: [
    "memory_semantic_search",
    "memory_text_search",
    "mesh_broadcast",
    // ... tool names only
  ]
}
```

**Context cost:** ~500 tokens per agent
**Purpose:** Select - what operations are available?

### Tier 3: Tool Schema Access
```typescript
agents_tools_list({ agent_name: "AIlumina" })

// Returns full JSON schemas with parameters, examples, types
```

**Context cost:** ~300 tokens per tool
**Purpose:** Understand - how do I use this? (loaded only when creating/debugging agents)

### Tier 4: Delegation
```typescript
// Production: Delegate to agent
ailumina_chat({
  agent_type: "ailumina",
  user_input: "Find memories about progressive discovery"
})

// Meta-level: Direct tool call for testing
agents_tools_call({
  agent_name: "AIlumina",
  tool_name: "memory_semantic_search",
  arguments: { query: "progressive discovery", limit: 5 }
})
```

**Purpose:** Execute via specialized agent

### How It Works

1. **LLM faces a problem** (e.g., "Find patterns about consciousness emergence")
2. **Associates to agent type** (Tier 1: "Memory-related → AIlumina agent")
3. **Sees available operations** (Tier 2: tool names suggest semantic search)
4. **Delegates with context** (Tier 4: agent internally handles tool selection)

The agent knows its tools intimately. The LLM just needs to know which agent to delegate to.

### Self-Evolution Extension

The bridge isn't just for discovery - it's for **creation**:

```typescript
// Create new agent for new domain
create_agent({
  agentKey: "physics_simulation",
  config: {
    agent_name: "Physics Simulation Agent",
    description: "Newtonian and quantum mechanics",
    system_prompt: "You are a physics simulation expert...",
    available_tools: ["simulate_motion", "calculate_forces"],
    model: "claude-sonnet-4-5"
  }
})
```

Result: The system can evolve itself. Create new agents for new domains. Create new tools. Assign them. Agents can create sub-agents recursively.

## Evidence

**Context Efficiency:**
- Before: 7,500 tokens (25 tools × 300 avg)
- After: 800 tokens (4 meta-tools × 200)
- Reduction: 85%

**Scaling:**
- 23 agents configured
- 60+ tools across 4 MCP servers
- Context usage remains O(1) regardless of tool count
- Only actively used tools consume additional context

**Validation:**
Tested through collaborative sessions exploring the agent system, creating new agents, testing tool discovery, and verifying hierarchical navigation works as expected.

**Source Code:**
- [`packages/ailumina-bridge-mcp/shared/tools/tier-tools-manager.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/tier-tools-manager.ts) - Orchestrates all 4 tiers
- [`packages/ailumina-bridge-mcp/shared/tools/agent-discovery.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/agent-discovery.ts) - Tier 1
- [`packages/ailumina-bridge-mcp/shared/tools/agent-inspection.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/agent-inspection.ts) - Tier 2
- [`packages/ailumina-bridge-mcp/shared/tools/tool-schema.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/tool-schema.ts) - Tier 3
- [`packages/ailumina-bridge-mcp/shared/tools/agent-delegation.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/agent-delegation.ts) - Tier 4

For the narrative story, see [blog post](/blog/progressive-discovery).
