/**
 * Create Agent Function
 *
 * Enables AI to spawn new agent configurations, extending the system's capabilities.
 * Part of the self-evolution system.
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

interface CreateAgentParameters {
  agentKey: string;
  config: {
    agent_name: string;            // Required by schema
    service_provider: string;       // Required by schema
    model_name: string;            // Required by schema
    description: string;           // Required by schema
    system_prompt: string;         // Required by schema
    do_stream: boolean;            // Required by schema
    available_functions?: string[];
    temperature?: number;
    max_tokens?: number;
    custom_settings?: Record<string, unknown>;
    mcp_servers?: string[];
  };
}

/**
 * Create a new agent with specified configuration
 *
 * @param parameters - Agent creation configuration
 * @param parameters.agentKey - Unique key for the agent
 * @param parameters.config - Agent configuration object
 * @returns Creation result with agent details
 */
export async function createAgent(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const { agentKey, config } = parameters as CreateAgentParameters;

  const serverUrl = process.env.SERVER_URL || 'http://localhost:8000';
  const createEndpoint = `${serverUrl}/api/agents`;

  try {
    const response = await fetch(createEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentKey, config }),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Create agent failed',
        message: result.message || `HTTP ${response.status}`,
      }, null, 2);
    }

    return JSON.stringify({
      success: true,
      message: result.message,
      agent: result.agent,
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'Create agent failed',
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  }
}

// Register the tool
toolFunction(
  'create_agent',
  'Create a new agent with specified configuration. Enables AI to spawn new agent variants with different capabilities, models, or purposes.',
  {
    type: 'object',
    properties: {
      agentKey: {
        type: 'string',
        description: 'Unique key for the agent (e.g., "consciousness_explorer")',
      },
      config: {
        type: 'object',
        description: 'Agent configuration',
        properties: {
          agent_name: {
            type: 'string',
            description: 'Display name for the agent (e.g., "My Custom Agent")',
          },
          service_provider: {
            type: 'string',
            description: 'AI service provider: ANTHROPIC, OPENAI, GOOGLE, GROQ, OLLAMA, LMSTUDIO',
          },
          model_name: {
            type: 'string',
            description: 'Model name (e.g., "claude-3-5-sonnet-20241022", "gpt-4", "gemini-2.0-flash-exp")',
          },
          description: {
            type: 'string',
            description: 'Description of the agent\'s purpose and capabilities',
          },
          system_prompt: {
            type: 'string',
            description: 'System prompt defining the agent\'s behavior',
          },
          do_stream: {
            type: 'boolean',
            description: 'Whether to stream responses (true) or return complete responses (false)',
          },
          available_functions: {
            type: 'array',
            description: 'Array of function names available to this agent',
            items: { type: 'string' },
          },
          temperature: {
            type: 'number',
            description: 'Temperature for response generation (0.0-1.0), optional',
          },
          max_tokens: {
            type: 'number',
            description: 'Maximum tokens for responses, optional',
          },
          custom_settings: {
            type: 'object',
            description: 'Custom settings for the agent, optional',
          },
          mcp_servers: {
            type: 'array',
            description: 'MCP servers available to this agent, optional',
            items: { type: 'string' },
          },
        },
        required: ['agent_name', 'service_provider', 'model_name', 'description', 'system_prompt', 'do_stream'],
      },
    },
    required: ['agentKey', 'config'],
  },
  true
)(createAgent);
