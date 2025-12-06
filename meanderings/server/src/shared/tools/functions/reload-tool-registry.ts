/**
 * Reload Tool Registry
 *
 * Hot-reloads the dynamic tool registry without restarting the server.
 * This enables AI self-evolution by allowing new tools to be discovered
 * and registered immediately after creation.
 *
 * **Self-Evolution Workflow**:
 * 1. AI creates a new tool file using /create-tool skill
 * 2. AI calls reload_tool_registry to discover the new tool
 * 3. New capability is immediately available
 * 4. AI has successfully evolved itself!
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

/**
 * Reload the dynamic tool registry to discover newly created tools
 *
 * This function makes an HTTP request to the server's reload endpoint
 * to trigger a fresh scan of the tools/functions directory and
 * re-register all discovered tools.
 */
export async function reloadToolset(
  _parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  try {
    // Get the server URL from environment or use default
    const serverUrl = process.env.SERVER_URL || 'http://localhost:8000';
    const reloadEndpoint = `${serverUrl}/api/mcp/tools/reload`;

    // Make HTTP POST request to reload endpoint
    const response = await fetch(reloadEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      return JSON.stringify({
        success: false,
        error: 'Reload request failed',
        status: response.status,
        message: errorData.message || 'Unknown error',
      });
    }

    const result = await response.json() as any;

    return JSON.stringify({
      success: true,
      message: 'Tool registry reloaded successfully',
      toolCount: result.toolCount,
      timestamp: result.timestamp,
      note: 'New tools are now available for use',
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'Failed to reload tool registry',
      message: error instanceof Error ? error.message : String(error),
      suggestion: 'Ensure the server is running and accessible',
    });
  }
}

// Register the tool function with the dynamic registry
toolFunction(
  'reload_toolset',
  'Hot-reload the dynamic tool registry to discover newly created tools without restarting the server. Essential for AI self-evolution - call this after creating new tools to make them immediately available.',
  {
    type: 'object',
    properties: {},
  },
  true
)(reloadToolset);
