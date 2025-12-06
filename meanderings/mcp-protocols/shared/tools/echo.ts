/**
 * Echo tool implementation
 */

import { ToolResult, EchoArgs } from "../types.js";
import { validateArgs, EchoArgsSchema } from "../utils/validation.js";

export const echoToolDefinition = {
  name: "echo",
  description: "Echo back the provided text - useful for testing connectivity",
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to echo back",
      },
    },
    required: ["text"],
  },
};

export function executeEchoTool(args: unknown): ToolResult {
  const validatedArgs = validateArgs(EchoArgsSchema, args);
  
  return {
    content: [
      {
        type: "text",
        text: `Echo: ${validatedArgs.text}`,
      },
    ],
  };
}