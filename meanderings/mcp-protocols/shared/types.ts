/**
 * Shared type definitions for MCP Remote Server
 */

/**
 * MCP Tool interfaces
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

/**
 * MCP Resource interfaces
 */
export interface Resource {
  uri: string;
  mimeType: string;
  name: string;
  description: string;
}

export interface ResourceContent {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}

/**
 * Tool argument interfaces
 */
export interface EchoArgs {
  text: string;
}

export interface CalculatorArgs {
  operation: "add" | "subtract" | "multiply" | "divide";
  a: number;
  b: number;
}

export interface WeatherArgs {
  location: string;
  units?: "celsius" | "fahrenheit";
}

/**
 * Server status and health interfaces
 */
export interface ServerStatus {
  status: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  timestamp: string;
  requestCount: number;
}

/**
 * HTTP Server specific interfaces
 */
export interface JsonRpcRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Sampling interfaces (STDIO only)
 */
export interface SamplingMessage {
  role: "user" | "assistant";
  content: {
    type: "text";
    text: string;
  };
}

export interface SamplingRequest {
  messages: SamplingMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  includeContext?: string;
}

export interface SamplingResult {
  role: "assistant";
  content: {
    type: "text";
    text: string;
  };
  model: string;
  stopReason?: "endTurn" | "stopSequence" | "maxTokens";
}

/**
 * Configuration interfaces
 */
export interface HttpServerConfig {
  port: number;
  host: string;
  apiKey: string;
  requireAuth: boolean;
}

export interface StdioWrapperConfig {
  remoteUrl: string;
  apiKey: string;
  enableSampling: boolean;
  samplingThreshold: number;
}

/**
 * Error types
 */
export class McpToolError extends Error {
  constructor(
    message: string,
    public code: number = -32602,
    public data?: any
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

/**
 * Utility types
 */
export type ToolHandler<T = any> = (args: T) => Promise<ToolResult> | ToolResult;
export type ResourceHandler = (uri: string) => Promise<ResourceContent> | ResourceContent;