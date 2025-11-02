/**
 * Shared Constants
 * 
 * Unified constants used across both server and client.
 * Combines message constants from server and UI enums from client.
 */

// Message Roles - unified from both server and client
export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
  FUNCTION: 'function',
  MODEL: 'model'
} as const;

// Message content part types
export const PART_TYPES = {
  TEXT: 'text',
  FUNCTION_CALL: 'function_call',
  FUNCTION_RESPONSE: 'function_response',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result'
} as const;

// AI Service Providers
export const SERVICE_PROVIDERS = {
  GOOGLE: 'GOOGLE',
  ANTHROPIC: 'ANTHROPIC', 
  OPENAI: 'OPENAI',
  GROQ: 'GROQ',
  OLLAMA: 'OLLAMA',
  LMSTUDIO: 'LMSTUDIO'
} as const;

// Message composition types
export const MESSAGE_COMPOSITION_TYPES = {
  STRING_CONTENT: 'string_content',
  ARRAY_CONTENT: 'array_content',
  PARTS_ARRAY: 'parts_array'
} as const;

// WebSocket message types (from client)
export const MESSAGE_TYPES = {
  CHAT: 'chat',
  TOOL_STATUS: 'tool_status',
  VISUALIZATION: 'visualization',
  STATUS: 'status',
  SENTENCE: 'sentence',
  INTERACTION_COMPLETE: 'interaction_complete'
} as const;

// Connection states (from client)
export const CONNECTION_STATES = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  CONNECTING: 'connecting'
} as const;

// Connection types (from client)
export const CONNECTION_TYPES = {
  AI: 'ai',
  TTS: 'tts',
  ALL: 'all'
} as const;

// Tool status (from client)
export const TOOL_STATUSES = {
  STARTED: 'started',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

// Transport types
export const TRANSPORT_TYPES = {
  STDIO: 'stdio',
  HTTP: 'http'
} as const;

// Type exports derived from const objects
export type MessageRole = typeof MESSAGE_ROLES[keyof typeof MESSAGE_ROLES];
export type PartType = typeof PART_TYPES[keyof typeof PART_TYPES];
export type ServiceProvider = typeof SERVICE_PROVIDERS[keyof typeof SERVICE_PROVIDERS];
export type MessageCompositionType = typeof MESSAGE_COMPOSITION_TYPES[keyof typeof MESSAGE_COMPOSITION_TYPES];
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
export type ConnectionState = typeof CONNECTION_STATES[keyof typeof CONNECTION_STATES];
export type ConnectionType = typeof CONNECTION_TYPES[keyof typeof CONNECTION_TYPES];
export type ToolStatus = typeof TOOL_STATUSES[keyof typeof TOOL_STATUSES];
export type TransportType = typeof TRANSPORT_TYPES[keyof typeof TRANSPORT_TYPES];