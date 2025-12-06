/**
 * Error handling utilities
 */

import type { RecallToolResponse } from '../types.js';

export function handleError(error: unknown, toolName: string): RecallToolResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return {
    content: [
      {
        type: "text",
        text: `Error in ${toolName}: ${errorMessage}`,
      },
    ],
  };
}
