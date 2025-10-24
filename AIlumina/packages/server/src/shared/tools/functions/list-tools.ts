/**
 * List Tools Function
 *
 * Enables AI to discover what tools are currently available in the system.
 * Part of the self-evolution system.
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

/**
 * List all available tools in the system
 *
 * @returns List of tool names with count
 */
export async function listAvailableTools(
  _parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:8000';
  const listEndpoint = `${serverUrl}/api/tools`;

  try {
    const response = await fetch(listEndpoint, {
      method: 'GET',
    });

    const result = await response.json() as any;

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: result.error || 'List tools failed',
        message: result.message || `HTTP ${response.status}`,
      }, null, 2);
    }

    return JSON.stringify({
      success: true,
      tools: result.tools,
      count: result.count,
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'List tools failed',
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  }
}

// Register the tool
toolFunction(
  'list_available_tools',
  'List all available tools in the system. Returns tool names and total count.',
  {
    type: 'object',
    properties: {},
    required: [],
  },
  true
)(listAvailableTools);
