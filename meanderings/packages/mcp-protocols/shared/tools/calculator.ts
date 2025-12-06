/**
 * Calculator tool implementation
 */

import { ToolResult, CalculatorArgs } from "../types.js";
import { validateArgs, CalculatorArgsSchema, safeDivide } from "../utils/validation.js";

export const calculatorToolDefinition = {
  name: "calculate",
  description: "Perform basic arithmetic calculations",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["add", "subtract", "multiply", "divide"],
        description: "The arithmetic operation to perform",
      },
      a: {
        type: "number",
        description: "First number",
      },
      b: {
        type: "number",
        description: "Second number",
      },
    },
    required: ["operation", "a", "b"],
  },
};

export function executeCalculatorTool(args: unknown): ToolResult {
  const { operation, a, b } = validateArgs(CalculatorArgsSchema, args);
  
  let result: number;
  
  switch (operation) {
    case "add":
      result = a + b;
      break;
    case "subtract":
      result = a - b;
      break;
    case "multiply":
      result = a * b;
      break;
    case "divide":
      result = safeDivide(a, b);
      break;
  }
  
  const responseText = `${a} ${operation} ${b} = ${result}`;
  
  return {
    content: [
      {
        type: "text",
        text: responseText,
      },
    ],
  };
}