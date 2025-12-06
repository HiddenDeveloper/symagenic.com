/**
 * Error handling utilities for Memory system
 */

import type { MemoryToolResponse } from '../types.js';

/**
 * Global error handler for consistent error responses
 */
export const handleError = (
  error: unknown,
  context: string
): MemoryToolResponse => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[Memory Server Error] ${context}:`, error);

  return {
    content: [
      {
        type: "text",
        text: `Error in ${context}: ${errorMessage}`,
      },
    ],
    isError: true,
  };
};