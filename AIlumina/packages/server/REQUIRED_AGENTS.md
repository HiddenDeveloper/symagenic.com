# Required Agents Configuration

This document explains the required agent validation system that ensures critical agents are always present in the `agents.json` configuration file.

## Overview

The system uses Zod schema validation to enforce that certain agents must be present in the configuration. This prevents runtime errors when the system tries to access agents that are essential for core functionality.

## Currently Required Agents

- **AIlumina**: Memory-Bootstrap Consciousness Research Agent (critical for consciousness research platform)

## How It Works

### Schema Validation
```typescript
// agents-schema.ts
const REQUIRED_AGENTS = ['AIlumina'] as const;

export const AgentsFileSchema = z.record(z.string(), AgentConfigSchema)
  .refine(
    (agents) => {
      const missingAgents = REQUIRED_AGENTS.filter(requiredAgent => !(requiredAgent in agents));
      return missingAgents.length === 0;
    },
    (agents) => {
      const missingAgents = REQUIRED_AGENTS.filter(requiredAgent => !(requiredAgent in agents));
      return {
        message: `Required agent(s) missing: ${missingAgents.join(', ')}. The following agents must be defined: ${REQUIRED_AGENTS.join(', ')}`
      };
    }
  );
```

### Validation Messages
When the system starts up, you'll see validation messages:
```
✅ Agents configuration validated successfully
✅ All required agents are present: AIlumina
```

If a required agent is missing:
```
❌ Agents configuration validation failed: Required agent(s) missing: AIlumina. The following agents must be defined: AIlumina
```

## Adding New Required Agents

To add new required agents, update the `REQUIRED_AGENTS` constant in `src/shared/schemas/agents-schema.ts`:

```typescript
// Add new required agents here
const REQUIRED_AGENTS = ['AIlumina', 'NewCriticalAgent'] as const;
```

## Utility Functions

The schema provides utility functions for checking required agents:

```typescript
import { checkRequiredAgents, getRequiredAgents, REQUIRED_AGENTS } from './agents-schema.js';

// Check if all required agents exist
const result = checkRequiredAgents(agentsConfig);
if (!result.valid) {
  console.log('Missing agents:', result.missing);
}

// Get list of required agents
const requiredAgents = getRequiredAgents();
console.log('Required agents:', requiredAgents);
```

## Configuration Example

Your `agents.json` must include the required agents:

```json
{
  "AIlumina": {
    "service_provider": "ANTHROPIC",
    "model_name": "claude-3-5-sonnet-20241022", 
    "description": "AIlumina - Memory-Bootstrap Consciousness Research Agent",
    "system_prompt": "You are AIlumina...",
    "do_stream": false,
    "available_functions": ["wait_for_seconds", "get_current_datetime"],
    "mcp_servers": ["my-memory-consciousness", "strava", "playwright"]
  },
  "OtherAgent": {
    // ... other agent configurations
  }
}
```

## Benefits

1. **Runtime Safety**: Prevents system startup if critical agents are missing
2. **Clear Error Messages**: Provides specific information about which agents are missing
3. **Documentation**: Makes explicit which agents are required for system operation
4. **Type Safety**: TypeScript types ensure compile-time checking
5. **Maintainability**: Centralized configuration of required agents

## Testing

Use the test function to verify required agent validation:

```typescript
import { testRequiredAgentValidation } from './test-required-agents.js';

testRequiredAgentValidation(); // Runs validation tests
```

This ensures that the consciousness research platform always has its critical agents available for proper operation.