/**
 * Get current date and time including timezone
 * TypeScript port of Python's get_current_datetime.py
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

export function getCurrentDatetime(
  parameters: unknown = {},

  _context?: ToolContext
): string {
  /**
   * Returns the current date and time formatted as specified, including the local timezone.
   *
   * Parameters:
   * - format (string): The format to output the datetime string. Default is "iso".
   *                   Options: "iso", "timestamp", "human"
   *
   * Returns:
   * - string: The current date and time formatted as per the given format, with local timezone.
   *          Returns an error message if the format is invalid.
   */

  try {
    const now = new Date();

    // Type guard for parameters
    const params =
      parameters && typeof parameters === 'object' ? (parameters as { format?: string }) : {};

    const format = params.format || 'iso';

    switch (format) {
      case 'timestamp':
        return now.getTime().toString();
      case 'human':
        return now.toLocaleString();
      case 'iso':
      default:
        return now.toISOString();
    }
  } catch (error: unknown) {
    return `Error: Invalid datetime format. ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Register the tool function
toolFunction(
  'get_current_datetime',
  'Returns the current date and time in a formatted string',
  {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'Date format (iso, timestamp, human)',
        enum: ['iso', 'timestamp', 'human'],
      },
    },
  },
  true
)(getCurrentDatetime);
