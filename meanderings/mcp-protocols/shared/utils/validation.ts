/**
 * Input validation utilities for MCP tools
 */

import { z } from "zod";
import { McpToolError } from "../types.js";

/**
 * Zod schemas for tool arguments
 */
export const EchoArgsSchema = z.object({
  text: z.string().min(1, "Text cannot be empty"),
});

export const CalculatorArgsSchema = z.object({
  operation: z.enum(["add", "subtract", "multiply", "divide"]),
  a: z.number().finite("First number must be finite"),
  b: z.number().finite("Second number must be finite"),
});

export const WeatherArgsSchema = z.object({
  location: z.string().min(1, "Location cannot be empty"),
  units: z.enum(["celsius", "fahrenheit"]).optional().default("celsius"),
});

/**
 * Generic validation helper
 */
export function validateArgs<T>(schema: z.ZodSchema<T>, args: unknown): T {
  try {
    return schema.parse(args);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new McpToolError(`Validation failed: ${message}`, -32602);
    }
    throw new McpToolError("Invalid arguments", -32602);
  }
}

/**
 * Safe number operations
 */
export function safeDivide(a: number, b: number): number {
  if (b === 0) {
    throw new McpToolError("Division by zero is not allowed", -32602);
  }
  if (!isFinite(a) || !isFinite(b)) {
    throw new McpToolError("Invalid numbers for division", -32602);
  }
  return a / b;
}

/**
 * Validate JSON-RPC request structure
 * More flexible validation for MCP protocol compatibility
 */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0").optional(), // Make optional for MCP compatibility
  id: z.union([z.string(), z.number()]).optional(), // Make optional for notifications
  method: z.string(),
  params: z.any().optional(),
});

export function validateJsonRpcRequest(body: unknown) {
  try {
    const parsed = JsonRpcRequestSchema.parse(body);
    // If id is missing, generate one for response tracking
    if (parsed.id === undefined) {
      parsed.id = Date.now();
    }
    // If jsonrpc is missing, add it
    if (!parsed.jsonrpc) {
      parsed.jsonrpc = "2.0" as const;
    }
    return parsed as {
      jsonrpc: "2.0";
      id: string | number;
      method: string;
      params?: any;
    };
  } catch (error) {
    throw new McpToolError("Invalid JSON-RPC request format", -32600);
  }
}