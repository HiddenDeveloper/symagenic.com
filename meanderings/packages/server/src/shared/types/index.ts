// Core message types supporting multiple AI provider formats
import { ServiceProvider as ServiceProviderType } from '../constants/message-constants.js';

// Re-export the comprehensive provider-agnostic types from message-types
export { Message, MessagePart, ContentBlock } from './message-types.js';

// Import Message type for use in interfaces below
import type { Message } from './message-types.js';

export interface ToolCall {
  id?: string;
  type?: 'function';
  function?: {
    name: string;
    arguments: string;
  };
  // For different provider formats
  name?: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
}

export interface UserRequest {
  chat_messages: Message[];
  user_input: string;
  fileId?: string;
}

// Agent configuration matching agents.json structure
export interface AgentConfig {
  agent_name: string;
  service_provider: ServiceProviderType;
  model_name: string;
  description: string;
  system_prompt: string;
  do_stream: boolean;
  available_functions?: string[];
  custom_settings?: Record<string, unknown>;
  mcp_servers?: string[];
}

export type AgentConfigCollection = Record<string, AgentConfig>;

// Service provider interface
export interface ServiceProvider {
  agent_name: string;
  service_provider: string;
  model_name: string;
  tool_registry?: Record<string, unknown>;
  usage_info: UsageInfo;

  makeApiCall(
    messages: Message[],
    userInput: string,
    websocket?: unknown,
    streamResponse?: boolean
  ): Promise<unknown>;

  transformToolRegistry(): unknown;
  logConversationMemory(messages: Message[]): string | null;
  setToolRegistryAdapter?(adapter: unknown): void;
}

// Tool registry types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  enabled: boolean;
}

export type ToolRegistry = Record<string, ToolDefinition>;

// Usage tracking
export interface UsageInfo {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
