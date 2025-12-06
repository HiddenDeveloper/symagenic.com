/**
 * Update Agent Function
 *
 * Enables AI to modify existing agent configurations, including adding new functions.
 * Part of the self-evolution system.
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

interface UpdateAgentParameters {
  agentKey: string;
  updates: {
    description?: string;
    available_functions?: string[];
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    model_name?: string;
  };
}

/**
 * Update an existing agent's configuration
 *
 * @param parameters - Update configuration
 * @param parameters.agentKey - Key of the agent to update
 * @param parameters.updates - Fields to update (partial configuration)
 * @returns Update result with modified agent details
 */
export async function updateAgent(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const { agentKey, updates } = parameters as UpdateAgentParameters;

  const serverUrl = process.env.SERVER_URL || 'http://localhost:8000';
  const updateEndpoint = `${serverUrl}/api/agents/${encodeURIComponent(agentKey)}`;

  try {
    const response = await fetch(updateEndpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Update agent failed',
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
      error: 'Update agent failed',
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  }
}

// Register the tool
toolFunction(
  'update_agent',
  'Update an existing agent\'s configuration. Can modify description, available functions, system prompt, temperature, max_tokens, or model. Enables AI to evolve agent capabilities over time.',
  {
    type: 'object',
    properties: {
      agentKey: {
        type: 'string',
        description: 'Key of the agent to update',
      },
      updates: {
        type: 'object',
        description: 'Fields to update (provide only the fields you want to change)',
        properties: {
          description: {
            type: 'string',
            description: 'Updated description of the agent\'s purpose',
          },
          available_functions: {
            type: 'array',
            description: 'Updated array of function names (replaces existing array)',
            items: { type: 'string' },
          },
          system_prompt: {
            type: 'string',
            description: 'Updated system prompt',
          },
          temperature: {
            type: 'number',
            description: 'Updated temperature (0.0-1.0)',
          },
          max_tokens: {
            type: 'number',
            description: 'Updated max tokens',
          },
          model_name: {
            type: 'string',
            description: 'Updated model name',
          },
        },
      },
    },
    required: ['agentKey', 'updates'],
  },
  true
)(updateAgent);
