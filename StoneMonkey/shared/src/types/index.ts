/**
 * Shared Types
 * 
 * Unified type definitions for messages and AI functionality
 * shared between server and client packages.
 */

import type { 
  MessageRole, 
  PartType, 
  ServiceProvider,
  MessageType,
  ConnectionState,
  ToolStatus
} from '../constants/index.js';

/**
 * Base message part interface - atomic building blocks
 */
export interface MessagePart {
  text?: string;
  type?: PartType;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
  [key: string]: unknown; // Extensible for provider-specific properties
}

/**
 * Content block interface for array-based content
 */
export interface ContentBlock {
  type: string;
  text?: string;
  tool_use_id?: string;
  tool_call_id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  is_error?: boolean;
  [key: string]: unknown; // Extensible for provider-specific properties
}

/**
 * Tool call interface supporting multiple provider formats
 */
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

/**
 * Universal message interface - shape-driven, not provider-specific
 */
export interface Message {
  role: MessageRole;
  content?: string | ContentBlock[];
  parts?: MessagePart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;

  // Metadata
  id?: string;
  timestamp?: string;

  // Internal tracking
  _compositionType?: string;
  _providerHint?: string; // Optional hint for optimization, not enforcement
}

/**
 * Message validation result
 */
export interface MessageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedShape: MessageShape;
}

/**
 * Message shape enumeration based on structure
 */
export enum MessageShape {
  STRING_CONTENT = 'string_content',
  ARRAY_CONTENT = 'array_content',
  PARTS_ARRAY = 'parts_array',
  TOOL_CALLS = 'tool_calls',
  UNKNOWN = 'unknown',
}

/**
 * User request interface for WebSocket communication
 */
export interface UserRequest {
  chat_messages: Message[];
  user_input: string;
  fileId?: string;
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  agent_name: string;
  service_provider: ServiceProvider;
  model_name: string;
  description: string;
  system_prompt: string;
  do_stream: boolean;
  available_functions?: string[];
  custom_settings?: Record<string, unknown>;
  mcp_servers?: string[];
}

export type AgentConfigCollection = Record<string, AgentConfig>;

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
}

export type ToolRegistry = Record<string, ToolDefinition>;

/**
 * Usage tracking interface
 */
export interface UsageInfo {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * WebSocket message interfaces (from client)
 */
export interface WebSocketMessage {
  id?: string | number;
  timestamp?: string;
  type: MessageType;
}

export interface ChatMessage extends WebSocketMessage {
  type: 'chat';
  role: MessageRole;
  content: string | ContentBlock[];
  parts?: MessagePart[];
  tool_calls?: ToolCall[];
}

export interface ToolStatusMessage extends WebSocketMessage {
  type: 'tool_status';
  tool_status: ToolStatus;
  tool_name: string;
  run_type?: string;
  execution_time?: number;
  details?: string;
}

export interface SentenceMessage extends WebSocketMessage {
  type: 'sentence';
  sentence: string;
  final_sentence?: boolean;
}

export interface InteractionCompleteMessage extends WebSocketMessage {
  type: 'interaction_complete';
  done: boolean;
}

/**
 * Message shape detection utility type
 */
export interface MessageShapeDetector {
  detectShape(message: Message): MessageShape;
  validateShape(message: Message, expectedShape: MessageShape): MessageValidationResult;
}