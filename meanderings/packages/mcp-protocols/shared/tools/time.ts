/**
 * Time tool implementation
 */

import { ToolResult } from "../types.js";

export const timeToolDefinition = {
  name: "get_time",
  description: "Get the current server time and date",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export function executeTimeTool(): ToolResult {
  const now = new Date();
  
  return {
    content: [
      {
        type: "text",
        text: `Current server time: ${now.toISOString()}`,
      },
    ],
  };
}