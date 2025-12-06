/**
 * Wait for a specified number of seconds before proceeding
 * TypeScript port of Python's wait_for_seconds.py
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

export async function waitForSeconds(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  /**
   * Waits for a specified number of seconds before proceeding.
   *
   * Parameters:
   * - seconds (number): The number of seconds to wait.
   *
   * Returns:
   * - string: A confirmation message indicating the wait duration.
   */

  try {
    // Type guard for parameters
    const params =
      parameters && typeof parameters === 'object' ? (parameters as { seconds?: number }) : {};

    const seconds = params.seconds ?? 0;

    if (seconds < 0) {
      return 'Error: The number of seconds cannot be negative.';
    }

    // Wait for the specified duration
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));

    return `Waited for ${seconds} second(s).`;
  } catch (error: unknown) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Register the tool function
toolFunction(
  'wait_for_seconds',
  'Waits for a specified number of seconds before proceeding.',
  {
    type: 'object',
    properties: {
      seconds: {
        type: 'integer',
        description: 'Number of seconds to wait.',
      },
    },
    required: ['seconds'],
  },
  true
)(waitForSeconds);
