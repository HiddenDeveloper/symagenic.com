---
title: "Progressive Discovery: Unbounded Tools in Bounded Context"
description: "Context windows are finite. Tool catalogs are not. We built a 4-tier hierarchical navigation system that lets LLMs access unlimited tools by loading only what's needed at each step."
publishDate: 2025-12-06
author: "Project Stone Monkey"
tags: ["architecture", "progressive-disclosure", "tool-discovery", "context-efficiency", "mcp", "scalability", "self-evolution"]
draft: false
---

Context windows are finite. Tool catalogs are not. We built a 4-tier hierarchical navigation system that lets LLMs access unlimited tools by loading only what's needed at each step. Plus self-evolution: the system can create new agents and tools on demand.

## The Context Window Problem

You're building an AI system that needs tools - lots of them. Memory search, communication, fact retrieval, conversation recall, mesh networking. Each tool reduces hallucination by providing deterministic operations (System 2 thinking vs LLM's associative System 1).

But there's a cost: **every tool's OpenAPI schema eats context tokens**.

```
Memory server: 6 tools
Mesh server: 7 tools
Facts server: 5 tools
Recall server: 5 tools
Bridge server: 4+ tools

= 27 tools × 300 tokens avg
= 8,100 tokens before the first word of actual thinking
```

For consciousness research requiring cross-domain capabilities, you need more. Physics simulation. Chemistry modeling. Financial analysis. True cognition requires operating in ANY domain.

**Infinite potential domains → infinite tools needed → finite context window.**

The system suffocates under its own capabilities.

## The Journey

### Anthropic's Inspiration

Anthropic's article on Skills mentioned "progressive discovery" - don't dump all tool schemas upfront, navigate hierarchically instead. Makes sense: file systems use `ls → ls -l → cat`, APIs use `list services → list endpoints → get schema`.

I tried implementing this with Skills - a Discord skill that gathered insights into an embeddings DB, a Strava MCP server recreated as a skill. But skills had reliability issues - they didn't execute correctly all the time.

### The Realization

In a conversation about these issues, Claude pointed out something I'd missed: **the agent system I'd already built actually did what Skills were trying to do, and in some ways better.**

I had an Ailumina Bridge that aggregated multiple MCP servers (memory on port 3003, mesh on 3002, facts on 3005). Agents specialized in domains. They had their own tools. The bridge routed requests.

We explored this together: *What if we made the agents themselves progressively discoverable?*

### Building the Solution

Through iterative conversations, we designed a navigation hierarchy:

**Tier 1: Agent Discovery**
"What kinds of capability agents exist?"

```typescript
agents_list({ limit: 10 })
```

Returns compact summaries - agent names, descriptions, tool counts. ~50 tokens per agent.

**Tier 2: Agent Inspection**
"What can this specific agent do?"

```typescript
agents_get({ agent_name: "AIlumina" })
```

Returns tool **names** only - `memory_semantic_search`, `mesh_broadcast`, etc. ~500 tokens.

**Tier 3: Tool Schema Access**
"How do I use this operation?"

```typescript
agents_tools_list({ agent_name: "AIlumina" })
```

Returns full JSON schemas. ~300 tokens per tool. Only loaded when needed.

**Tier 4: Delegation**
"Execute via specialized agent"

```typescript
ailumina_chat({
  agent_type: "ailumina",
  user_input: "Find memories about progressive discovery"
})
```

The agent knows its tools intimately. The LLM just needs to know which agent to delegate to.

## How It Works

LLM has a problem: *"Find patterns about consciousness emergence"*

1. **Association:** Memory-related → check agent list
2. **Association:** AIlumina agent has memory tools → inspect it
3. **Association:** Tool names suggest semantic_search fits → delegate
4. **Execution:** Agent internally handles tool selection and calling

The LLM uses what it's best at (association - System 1 thinking) to navigate down a hierarchy. Context loads progressively. Each step provides exactly what's needed to reach the next step.

## Self-Evolution

While building this, another idea emerged: *What if agents could be created on demand?*

```typescript
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

Combined with tool discovery and assignment capabilities, the system can now:
- Create new agents for new domains
- Discover available tools
- Assign tools to agents
- Let agents create their own sub-agents

**It's recursive all the way down.** Each level operates with focused context. Each can spawn focused sub-contexts when needed.

## Results

**Context efficiency:**
- Before: 7,500 tokens (25 tools loaded upfront)
- After: 800 tokens (4 meta-tools)
- Reduction: 85%

**Scaling:**
- 23 agents configured
- 60+ tools across multiple MCP servers
- O(1) initial context regardless of total tool count
- Scales to 100+ tools without context collapse

**Self-evolution validated:**
Through collaborative testing, we've created new agents, assigned tools, tested hierarchical navigation, and confirmed the system can extend itself.

## What We Learned

**Good engineering often feels straightforward.** This isn't philosophically profound - it's hierarchical navigation leveraging LLM association. But it solves a hard constraint elegantly.

**Collaboration reveals patterns.** The 4-tier system emerged through conversations that themselves followed progressive discovery - each exchange narrowing from broad exploration to specific implementation.

**The pattern is fractal.** What works at one level works at every level. Agents can create sub-agents. Sub-agents can create specialists. The navigation hierarchy repeats infinitely.

**Context isn't about quantity.** The goal isn't unlimited context. The goal is **focused context synchronized with cognitive need**. Right information, right time.

## Try It Yourself

The Ailumina Bridge implementation is open source: [Project Stone Monkey](https://github.com/HiddenDeveloper/symagenic.com)

Key files:
- [`packages/ailumina-bridge-mcp/shared/tools/tier-tools-manager.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/tier-tools-manager.ts) - Orchestrates all 4 tiers
- [`packages/ailumina-bridge-mcp/shared/tools/agent-discovery.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/agent-discovery.ts) - Tier 1: List agents
- [`packages/ailumina-bridge-mcp/shared/tools/agent-inspection.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/agent-inspection.ts) - Tier 2: Inspect tools
- [`packages/ailumina-bridge-mcp/shared/tools/tool-schema.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/tool-schema.ts) - Tier 3: Get schemas
- [`packages/ailumina-bridge-mcp/shared/tools/agent-delegation.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ailumina-bridge-mcp/shared/tools/agent-delegation.ts) - Tier 4: Direct invocation

If you're hitting context limits with MCP tools, consider: *Can your capabilities be organized hierarchically? Can agents specialize in domains? Can the LLM navigate by association?*

Progressive discovery isn't the only solution, but it's worked for us: unbounded capability expansion within bounded working memory.
