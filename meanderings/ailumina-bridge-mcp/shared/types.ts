/**
 * Shared types for Ailumina Bridge dual-transport server
 */

export interface AiluminaToolRequest {
  toolName: string;
  parameters: Record<string, any>;
}

export interface AiluminaToolResponse {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface AiluminaChatParams {
  agent_type: "crud" | "news" | "collaborator" | "ailumina";
  user_input: string;
  chat_messages?: Array<{ role: string; content: string }>;
  fileId?: string;
  server_url?: string;
}

export interface EchoParams {
  text: string;
}

export interface CalculateParams {
  expression: string;
}

export interface GetTimeParams {
  format?: "iso" | "timestamp" | "human";
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}