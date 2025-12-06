/**
 * Delete Agent Function
 *
 * Enables AI to remove agent configurations from the system.
 * Part of the self-evolution system.
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

interface DeleteAgentParameters {
  agentKey: string;
}

/**
 * Delete an agent configuration
 *
 * @param parameters - Deletion configuration
 * @param parameters.agentKey - Key of the agent to delete
 * @returns Deletion result
 */
export async function deleteAgent(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const { agentKey } = parameters as DeleteAgentParameters;

  const serverUrl = process.env.SERVER_URL || 'http://localhost:8000';
  const deleteEndpoint = `${serverUrl}/api/agents/${encodeURIComponent(agentKey)}`;

  try {
    const response = await fetch(deleteEndpoint, {
      method: 'DELETE',
    });

    const result = await response.json() as any;

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Delete agent failed',
        message: result.message || `HTTP ${response.status}`,
      }, null, 2);
    }

    return JSON.stringify({
      success: true,
      message: result.message,
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'Delete agent failed',
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  }
}

// Register the tool
toolFunction(
  'delete_agent',
  'Delete an agent configuration from the system. This permanently removes the agent from agents.json with automatic backup.',
  {
    type: 'object',
    properties: {
      agentKey: {
        type: 'string',
        description: 'Key of the agent to delete',
      },
    },
    required: ['agentKey'],
  },
  true
)(deleteAgent);
