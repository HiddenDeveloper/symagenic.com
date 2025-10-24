/**
 * Get Agent Function
 *
 * Enables AI to inspect agent configurations and understand available capabilities.
 * Part of the self-evolution system.
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

interface GetAgentParameters {
  agentKey: string;
}

/**
 * Get details about a specific agent
 *
 * @param parameters - Query parameters
 * @param parameters.agentKey - Key of the agent to retrieve
 * @returns Agent configuration details
 */
export async function getAgent(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const { agentKey } = parameters as GetAgentParameters;

  const serverUrl = process.env.SERVER_URL || 'http://localhost:8000';
  const getEndpoint = `${serverUrl}/api/agents/${encodeURIComponent(agentKey)}`;

  try {
    const response = await fetch(getEndpoint, {
      method: 'GET',
    });

    const result = await response.json() as any;

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Get agent failed',
        message: result.message || `HTTP ${response.status}`,
      }, null, 2);
    }

    return JSON.stringify({
      success: true,
      agent: result.agent,
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'Get agent failed',
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  }
}

// Register the tool
toolFunction(
  'get_agent',
  'Get details about a specific agent configuration. Returns the agent\'s model, available functions, system prompt, and other settings.',
  {
    type: 'object',
    properties: {
      agentKey: {
        type: 'string',
        description: 'Key of the agent to retrieve (e.g., "ailumina", "crud", "news")',
      },
    },
    required: ['agentKey'],
  },
  true
)(getAgent);
