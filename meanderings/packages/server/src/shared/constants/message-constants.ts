/**
 * Message Constants
 *
 * Defines all message-related constants using 'const as' pattern
 * for type safety and avoiding string literals throughout the codebase.
 */

export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
  FUNCTION: 'function',
  MODEL: 'model',
} as const;

export const PART_TYPES = {
  TEXT: 'text',
  FUNCTION_CALL: 'function_call',
  FUNCTION_RESPONSE: 'function_response',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
} as const;

export const SERVICE_PROVIDERS = {
  GOOGLE: 'GOOGLE',
  ANTHROPIC: 'ANTHROPIC',
  OPENAI: 'OPENAI',
  GROQ: 'GROQ',
  OLLAMA: 'OLLAMA',
  LMSTUDIO: 'LMSTUDIO',
} as const;

export const MESSAGE_COMPOSITION_TYPES = {
  STRING_CONTENT: 'string_content',
  ARRAY_CONTENT: 'array_content',
  PARTS_ARRAY: 'parts_array',
} as const;

export const TRANSPORT_TYPES = {
  STDIO: 'stdio',
  HTTP: 'http',
} as const;

// Type exports derived from const objects
export type MessageRole = (typeof MESSAGE_ROLES)[keyof typeof MESSAGE_ROLES];
export type PartType = (typeof PART_TYPES)[keyof typeof PART_TYPES];
export type ServiceProvider = (typeof SERVICE_PROVIDERS)[keyof typeof SERVICE_PROVIDERS];
