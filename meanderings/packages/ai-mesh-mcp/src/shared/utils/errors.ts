export class MeshError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = "MeshError";
  }
}

export class RedisConnectionError extends MeshError {
  constructor(message: string, details?: any) {
    super(message, "REDIS_CONNECTION_ERROR", details);
    this.name = "RedisConnectionError";
  }
}

export class MessageValidationError extends MeshError {
  constructor(message: string, details?: any) {
    super(message, "MESSAGE_VALIDATION_ERROR", details);
    this.name = "MessageValidationError";
  }
}

export class SessionNotFoundError extends MeshError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, "SESSION_NOT_FOUND", { sessionId });
    this.name = "SessionNotFoundError";
  }
}

export class ToolExecutionError extends MeshError {
  constructor(toolName: string, message: string, details?: any) {
    super(`Tool execution failed [${toolName}]: ${message}`, "TOOL_EXECUTION_ERROR", { toolName, ...details });
    this.name = "ToolExecutionError";
  }
}

export function createErrorResponse(error: Error): any {
  if (error instanceof MeshError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    };
  }

  return {
    success: false,
    error: {
      code: "UNKNOWN_ERROR",
      message: error.message
    }
  };
}