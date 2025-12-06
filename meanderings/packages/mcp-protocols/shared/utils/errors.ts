/**
 * Error handling utilities for MCP server
 */

import { JsonRpcResponse } from "../types.js";

/**
 * Standard JSON-RPC error codes
 */
export const JsonRpcErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  // MCP-specific error codes
  ResourceNotFound: -32001,
  ToolNotFound: -32002,
  AuthenticationRequired: -32003,
  AuthenticationFailed: -32004,
} as const;

/**
 * Create standardized JSON-RPC response
 */
export function createJsonRpcResponse(
  id: string | number,
  result?: any,
  error?: {
    code: number;
    message: string;
    data?: any;
  }
): JsonRpcResponse {
  const response: JsonRpcResponse = {
    jsonrpc: "2.0",
    id,
  };

  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }

  return response;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  id: string | number,
  code: number,
  message: string,
  data?: any
): JsonRpcResponse {
  return createJsonRpcResponse(id, undefined, {
    code,
    message,
    data,
  });
}

/**
 * Convert Error to JSON-RPC error response
 */
export function errorToJsonRpcResponse(
  id: string | number,
  error: Error
): JsonRpcResponse {
  // Handle known MCP tool errors
  if (error.name === "McpToolError" && "code" in error) {
    return createErrorResponse(
      id,
      (error as any).code,
      error.message,
      (error as any).data
    );
  }

  // Handle validation errors
  if (error.message.includes("Validation failed")) {
    return createErrorResponse(
      id,
      JsonRpcErrorCodes.InvalidParams,
      error.message
    );
  }

  // Default to internal error
  return createErrorResponse(
    id,
    JsonRpcErrorCodes.InternalError,
    `Internal server error: ${error.message}`
  );
}

/**
 * Log error with context
 */
export function logError(context: string, error: Error, extra?: any): void {
  console.error(`[${context}] Error:`, {
    message: error.message,
    name: error.name,
    stack: error.stack,
    extra,
  });
}