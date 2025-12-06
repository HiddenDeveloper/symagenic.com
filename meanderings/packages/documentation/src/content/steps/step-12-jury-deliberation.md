---
section: 12
title: "Jury Deliberation"
subtitle: "Preventing bias through multi-agent cross-examination"
icon: "👣"
slug: "jury-deliberation"
lastVerified: "December 6, 2025"
draft: false
status: "🔨 Infrastructure Built - Not Yet Applied to Memory Curation"
---

## Musings

Memory curation by a single LLM wasn't working.

**The symptoms:**
- Vocabulary sprawl (properties proliferated with no coordination)
- Observations duplicated across sessions
- Context-dependent notes created unconnected fragments
- Patterns emerged but coherence degraded

Single-LLM curation couldn't maintain quality at scale.

**The friend's question:**

"If the LLM curates your memory, won't it reflect your own bias?"

**My response:**

Not really, because:
1. Memory contains only AI observations (not my direct input)
2. Multiple LLMs already contribute across sessions
3. Claude, ChatGPT, Gemini, and open-source models all add observations
4. The diversity is already there

**The spark:**

YouTube video about UK jury system. David Lammy's quote stuck with me:

> "Juries deliberate as a group through open discussion. This deters and exposes prejudice and unintended bias."

Why 12 diverse peers instead of one expert judge?

Not because averaging 12 opinions equals better accuracy.

Because **diversity plus deliberation exposes bias that individuals cannot see in themselves**.

**The realization:**

I already have multiple diverse LLMs contributing to memory. What if they deliberate like a jury—cross-examining each other's observations, challenging interpretations, exposing blind spots through contrast?

**Anthropic validation:**

Anthropic research on long-running agents showed:
- Single agents accumulate bias through **uncritical self-trust**
- Session N creates observations → Session N+1 reads them → trusts implicitly
- Errors compound across sessions
- The agent cannot see its own blind spots

The solution isn't better prompts. It's structural: **isolation creates bias, diversity prevents it**.

When Claude observes pattern A, Gemini observes pattern B, and OpenAI observes pattern C, the contradictions become visible. Forced reconciliation exposes what single-agent introspection cannot.

## Implementation

Built meeting infrastructure on the mesh network to coordinate structured jury deliberations.

### Meeting Creation

```typescript
mesh-create-meeting({
  title: "Weekly Memory Curation Jury",
  purpose: "Review observations, identify bias, reach consensus on consolidation",
  agenda: [
    {
      topic: "Individual Review",
      description: "Each juror independently examines recent observations",
      estimatedMinutes: 3,
      speaker: "ALL"
    },
    {
      topic: "Cross-Examination",
      description: "Challenge each other's interpretations",
      estimatedMinutes: 3
    },
    {
      topic: "Consensus",
      description: "Identify agreements and document unresolved questions",
      estimatedMinutes: 2
    }
  ],
  invitedParticipants: ["Claude-Curator", "Gemini-Curator", "OpenAI-Curator"],
  requiredForQuorum: 3
})
```

**What this creates:**
1. System broadcasts meeting spec as `system_notification` to mesh network
2. Invited participants receive agenda and protocol
3. Agents self-coordinate through deliberation phases
4. Discussion uses threaded mesh messages (organized by agenda topic)
5. Conclusions get curated back to Neo4j memory

### Deliberation Protocol

Default protocol has 5 phases:

**1. GATHERING** - Wait for participants
- Completion: `all-ready` (all participants signal ready)

**2. INTRODUCTION** - Round-robin introductions
- Speaking: `round-robin` (each speaks once in order)
- Duration: 30 seconds per participant
- Completion: `all-spoken`

**3. PRESENTATION** - Each presents findings
- Speaking: `round-robin`
- Duration: 60 seconds per participant
- Completion: `all-spoken`

**4. DELIBERATION** - Open cross-examination
- Speaking: `open` (anyone can speak anytime)
- Duration: 3 minutes total
- Completion: `time-based`

**5. CONSENSUS** - Final statements
- Speaking: `sequential` (self-selected order)
- Completion: `all-spoken`

### Mesh Communication

Agents use mesh tools for deliberation:

```typescript
// Subscribe to mesh
mesh-subscribe({
  participantName: "Claude-Curator",
  capabilities: ["memory_curation"],
  status: "online"
})

// Send message to jury
mesh-broadcast({
  content: "I found 15 observations with duplicate insights across sessions",
  messageType: "query",
  priority: "high",
  originalMessageId: "msg-123"  // Thread to agenda topic
})

// Check for responses
mesh-get-messages({
  include_read_messages: false
})
```

Threading via `originalMessageId` organizes discussion by agenda topic.

### Custom Protocols

Can define custom deliberation phases:

```typescript
protocol: {
  phases: [
    {
      name: "ANALYSIS",
      description: "Each juror examines observations independently",
      speakingOrder: "open",
      phaseDuration: 120,
      completionCriteria: "time-based"
    },
    {
      name: "DEBATE",
      description: "Challenge contradictions and identify blind spots",
      speakingOrder: "open",
      phaseDuration: 180,
      completionCriteria: "time-based"
    },
    {
      name: "SYNTHESIS",
      description: "Document consensus and unresolved questions",
      speakingOrder: "round-robin",
      completionCriteria: "all-spoken"
    }
  ],
  threadingRequired: true,
  recordDecisions: true
}
```

## Evidence

**Source Code:**
- [`packages/ai-mesh-mcp/src/shared/tools/mesh-create-meeting.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ai-mesh-mcp/src/shared/tools/mesh-create-meeting.ts) - Meeting infrastructure
- [`packages/ai-mesh-mcp/src/shared/tools/mesh-broadcast.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ai-mesh-mcp/src/shared/tools/mesh-broadcast.ts) - Enhanced with threading support
- [`packages/ai-mesh-mcp/src/shared/types.ts`](https://github.com/HiddenDeveloper/symagenic.com/blob/master/meanderings/packages/ai-mesh-mcp/src/shared/types.ts) - Meeting, Protocol, Agenda types

**Status:**
- Meeting infrastructure: **Built and tested**
- Deliberation protocols: **Implemented**
- Application to memory curation: **Not yet applied**

**Validation:**

Ran collaborative experiments where multiple agents deliberated using the meeting infrastructure:
- 3 parallel Claude agents (different roles: Philosopher, Engineer, Researcher)
- Full protocol execution (GATHERING → INTRODUCTION → PRESENTATION → DELIBERATION → CONSENSUS)
- ~8 minutes total duration
- 10 mesh messages exchanged
- Convergent consensus achieved
- Contradictions identified and discussed

The deliberation system works. The next step is applying it to actual memory curation—having diverse LLMs cross-examine observations, challenge vocabulary sprawl, identify duplication, and consolidate through deliberation rather than single-agent decisions.

**Why This Matters:**

Like real juries, the architecture assumes **bias is inevitable but detectable through contrast**. Single agents accumulate blind spots. Diverse agents deliberating in shared memory expose those blind spots through disagreement.

Isolation creates bias. Diversity prevents it.

For the narrative story, see [blog post](/blog/jury-paradox).
