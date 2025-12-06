/**
 * Message Types
 *
 * Structural message interfaces that are provider-agnostic.
 * Message shape determines behavior, not provider-specific classes.
 */

import { MessageRole, PartType } from '../constants/message-constants.js';
import type { ToolCall } from './index.js';

/**
 * Base message part interface - atomic building blocks
 */
export interface MessagePart {
  text?: string;
  type?: PartType;
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
  [key: string]: unknown; // Extensible for provider-specific properties
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
 * Message shape detection utility type
 */
export interface MessageShapeDetector {
  detectShape(message: Message): MessageShape;
  validateShape(message: Message, expectedShape: MessageShape): MessageValidationResult;
}
