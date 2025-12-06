/**
 * Delete Tool Function
 *
 * Enables AI to remove tools from the system, with automatic registry reload.
 * Part of the self-evolution system.
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

interface DeleteToolParameters {
  toolName: string;
}

/**
 * Delete a tool from the system
 *
 * @param parameters - Deletion configuration
 * @param parameters.toolName - Name of the tool to delete (without .ts extension)
 * @returns Deletion result with reload status
 */
export async function deleteTool(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const { toolName } = parameters as DeleteToolParameters;

  const serverUrl = process.env.SERVER_URL || 'http://localhost:8000';
  const deleteEndpoint = `${serverUrl}/api/tools/${encodeURIComponent(toolName)}`;

  try {
    const response = await fetch(deleteEndpoint, {
      method: 'DELETE',
    });

    const result = await response.json() as any;

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Delete tool failed',
        message: result.message || `HTTP ${response.status}`,
      }, null, 2);
    }

    return JSON.stringify({
      success: true,
      message: result.message,
      reload: result.reload,
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'Delete tool failed',
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  }
}

// Register the tool
toolFunction(
  'delete_tool',
  'Delete a tool from the system and automatically reload the tool registry. Removes the tool file permanently.',
  {
    type: 'object',
    properties: {
      toolName: {
        type: 'string',
        description: 'Name of the tool to delete (without .ts extension)',
      },
    },
    required: ['toolName'],
  },
  true
)(deleteTool);
