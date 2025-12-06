/**
 * Message Shape Composer
 *
 * Universal message composition based purely on message shape.
 * Shape determines behavior, NOT provider names.
 *
 * Shapes:
 * - parts[] → Google-style parts array
 * - content[] → Anthropic-style content blocks
 * - tool_calls[] → OpenAI-style tool calls
 * - string content → Universal simple format
 */

import {
  Message,
  MessageShape,
  MessageValidationResult,
  MessagePart,
  ContentBlock,
} from '../types/message-types.js';
import type { ToolCall } from '../types/index.js';
import { MESSAGE_ROLES } from '../constants/message-constants.js';

/**
 * Shape detection result
 */
export interface DetectedShape {
  shape: MessageShape;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Universal message shape composer
 * Handles ALL message composition based on structure, not provider
 */
export class MessageShapeComposer {
  /**
   * Detect the shape of a message
   */
  detectShape(message: Message): DetectedShape {
    // Parts array (Google-style)
    if (message.parts && Array.isArray(message.parts)) {
      return {
        shape: MessageShape.PARTS_ARRAY,
        confidence: 1.0,
        metadata: {
          partCount: message.parts.length,
          hasText: message.parts.some((p) => 'text' in p),
          hasFunctionCall: message.parts.some((p) => 'functionCall' in p),
          hasFunctionResponse: message.parts.some((p) => 'functionResponse' in p),
        },
      };
    }

    // Content blocks array (Anthropic-style)
    if (message.content && Array.isArray(message.content)) {
      return {
        shape: MessageShape.ARRAY_CONTENT,
        confidence: 1.0,
        metadata: {
          blockCount: message.content.length,
          blockTypes: [...new Set(message.content.map((b) => b.type))],
          hasText: message.content.some((b) => b.type === 'text'),
          hasToolUse: message.content.some((b) => b.type === 'tool_use'),
          hasToolResult: message.content.some((b) => b.type === 'tool_result'),
        },
      };
    }

    // Tool calls (OpenAI-style)
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      return {
        shape: MessageShape.TOOL_CALLS,
        confidence: 1.0,
        metadata: {
          callCount: message.tool_calls.length,
          toolNames: message.tool_calls.map((tc: ToolCall) => tc.function?.name || tc.name),
          hasContent: !!message.content,
        },
      };
    }

    // String content (Universal)
    if (typeof message.content === 'string') {
      return {
        shape: MessageShape.STRING_CONTENT,
        confidence: 1.0,
        metadata: {
          length: message.content.length,
          hasToolCallId: !!message.tool_call_id,
          isToolMessage: message.role === MESSAGE_ROLES.TOOL,
        },
      };
    }

    // Unknown/empty message
    return {
      shape: MessageShape.STRING_CONTENT,
      confidence: 0.5,
      metadata: { fallback: true },
    };
  }

  /**
   * Compose a message based on its detected shape
   */
  compose(message: Message): Message {
    const detection = this.detectShape(message);

    switch (detection.shape) {
      case MessageShape.PARTS_ARRAY:
        return this.composeParts(message);

      case MessageShape.ARRAY_CONTENT:
        return this.composeContentBlocks(message);

      case MessageShape.TOOL_CALLS:
        return this.composeToolCalls(message);

      case MessageShape.STRING_CONTENT:
      default:
        return this.composeStringContent(message);
    }
  }

  /**
   * Validate a message based on its shape
   */
  validate(message: Message): MessageValidationResult {
    const detection = this.detectShape(message);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic message validation
    if (!message.role) {
      errors.push('Message role is required');
    }

    // Shape-specific validation
    switch (detection.shape) {
      case MessageShape.PARTS_ARRAY:
        this.validatePartsMessage(message, errors);
        break;

      case MessageShape.ARRAY_CONTENT:
        this.validateContentBlocksMessage(message, errors, warnings);
        break;

      case MessageShape.TOOL_CALLS:
        this.validateToolCallsMessage(message, errors);
        break;

      case MessageShape.STRING_CONTENT:
        this.validateStringMessage(message, errors, warnings);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detectedShape: detection.shape,
    };
  }

  // ===== SHAPE-SPECIFIC COMPOSITION =====

  /**
   * Compose parts[] array message (Google-style)
   */
  private composeParts(message: Message): Message {
    if (!message.parts || !Array.isArray(message.parts)) {
      return message;
    }

    const composedParts = message.parts.map((part) => {
      // Ensure proper part structure
      if ('text' in part) {
        return { text: part.text };
      } else if ('functionCall' in part) {
        const functionCall = part.functionCall as { name: string; args: Record<string, unknown> };
        return {
          functionCall: {
            name: functionCall.name,
            args: functionCall.args || {},
          },
        };
      } else if ('functionResponse' in part) {
        const functionResponse = part.functionResponse as { name: string; response: unknown };
        return {
          functionResponse: {
            name: functionResponse.name,
            response: functionResponse.response || {},
          },
        };
      }
      return part;
    });

    return {
      ...message,
      parts: composedParts,
      _compositionType: MessageShape.PARTS_ARRAY,
    };
  }

  /**
   * Compose content[] blocks message (Anthropic-style)
   */
  private composeContentBlocks(message: Message): Message {
    if (!Array.isArray(message.content)) {
      return message;
    }

    const composedContent = message.content.map((block) => {
      // Ensure proper block structure
      if (block.type === 'text') {
        return {
          type: 'text',
          text: block.text || '',
        };
      } else if (block.type === 'tool_use') {
        return {
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input || {},
        };
      } else if (block.type === 'tool_result') {
        return {
          type: 'tool_result',
          tool_use_id: block.tool_use_id,
          content: block.content || '',
        };
      }
      return block;
    });

    return {
      ...message,
      content: composedContent,
      _compositionType: MessageShape.ARRAY_CONTENT,
    };
  }

  /**
   * Compose tool_calls[] message (OpenAI-style)
   */
  private composeToolCalls(message: Message): Message {
    if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
      return message;
    }

    const composedToolCalls = message.tool_calls.map((toolCall: ToolCall) => {
      return {
        id: toolCall.id,
        type: toolCall.type || 'function',
        function: {
          name: toolCall.function?.name || '',
          arguments:
            typeof toolCall.function?.arguments === 'string'
              ? toolCall.function.arguments
              : JSON.stringify(toolCall.function?.arguments || {}),
        },
      };
    });

    return {
      ...message,
      tool_calls: composedToolCalls,
      _compositionType: MessageShape.TOOL_CALLS,
    };
  }

  /**
   * Compose string content message (Universal)
   */
  private composeStringContent(message: Message): Message {
    return {
      ...message,
      content: typeof message.content === 'string' ? message.content : '',
      _compositionType: MessageShape.STRING_CONTENT,
    };
  }

  // ===== SHAPE-SPECIFIC VALIDATION =====

  /**
   * Validate parts[] message structure and rules
   */
  private validatePartsMessage(message: Message, errors: string[]): void {
    if (!message.parts || !Array.isArray(message.parts)) {
      errors.push('Parts array is required for parts message');
      return;
    }

    for (const part of message.parts) {
      // Validate part structure
      if (!('text' in part || 'functionCall' in part || 'functionResponse' in part)) {
        errors.push('Each part must have text, functionCall, or functionResponse');
      }

      // Validate function calls are in model/assistant role
      if (
        'functionCall' in part &&
        message.role !== MESSAGE_ROLES.ASSISTANT &&
        message.role !== MESSAGE_ROLES.MODEL
      ) {
        errors.push('functionCall parts must be in assistant/model role');
      }

      // Validate function responses are in user role
      if ('functionResponse' in part && message.role !== MESSAGE_ROLES.USER) {
        errors.push('functionResponse parts must be in user role');
      }
    }
  }

  /**
   * Validate content[] blocks structure and rules
   */
  private validateContentBlocksMessage(
    message: Message,
    errors: string[],
    warnings: string[]
  ): void {
    if (!Array.isArray(message.content)) {
      errors.push('Content blocks array is required for content blocks message');
      return;
    }

    for (const block of message.content) {
      // Validate block structure
      if (!block.type) {
        errors.push('Each content block must have a type');
        continue;
      }

      // Validate tool_use blocks are in assistant role
      if (block.type === 'tool_use' && message.role !== MESSAGE_ROLES.ASSISTANT) {
        errors.push('tool_use blocks must be in assistant role');
      }

      // Validate tool_result blocks are in user role
      if (block.type === 'tool_result' && message.role !== MESSAGE_ROLES.USER) {
        errors.push('tool_result blocks must be in user role');
      }

      // Validate required fields
      if (block.type === 'text' && !block.text) {
        warnings.push('Text blocks should have text content');
      }

      if (block.type === 'tool_use' && (!block.id || !block.name)) {
        errors.push('tool_use blocks must have id and name');
      }

      if (block.type === 'tool_result' && !block.tool_use_id) {
        errors.push('tool_result blocks must have tool_use_id');
      }
    }
  }

  /**
   * Validate tool_calls[] structure and rules
   */
  private validateToolCallsMessage(message: Message, errors: string[]): void {
    if (!message.tool_calls || !Array.isArray(message.tool_calls)) {
      errors.push('Tool calls array is required for tool calls message');
      return;
    }

    // tool_calls must be in assistant role
    if (message.role !== MESSAGE_ROLES.ASSISTANT) {
      errors.push('tool_calls must be in assistant role');
    }

    for (const toolCall of message.tool_calls) {
      // Validate tool call structure
      if (!toolCall.id) {
        errors.push('Each tool call must have an id');
      }

      if (!toolCall.function) {
        errors.push('Each tool call must have function');
      }

      if (toolCall.function && !toolCall.function.name) {
        errors.push('Tool call function must have a name');
      }
    }
  }

  /**
   * Validate string content structure and rules
   */
  private validateStringMessage(message: Message, errors: string[], warnings: string[]): void {
    // tool_call_id only valid with tool role
    if (message.tool_call_id && message.role !== MESSAGE_ROLES.TOOL) {
      errors.push('tool_call_id can only be used with tool role');
    }

    // tool role should have tool_call_id
    if (message.role === MESSAGE_ROLES.TOOL && !message.tool_call_id) {
      warnings.push('Tool role messages should have tool_call_id');
    }

    // content should be string for string message shape
    if (message.content && typeof message.content !== 'string') {
      errors.push('String message content must be a string');
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Convert any message to a specific shape
   */
  convertToShape(message: Message, targetShape: MessageShape): Message {
    const currentDetection = this.detectShape(message);

    if (currentDetection.shape === targetShape) {
      return message; // Already correct shape
    }

    // Conversion logic between shapes
    switch (targetShape) {
      case MessageShape.STRING_CONTENT:
        return this.convertToStringContent(message);

      case MessageShape.PARTS_ARRAY:
        return this.convertToPartsArray(message);

      case MessageShape.ARRAY_CONTENT:
        return this.convertToContentBlocks(message);

      case MessageShape.TOOL_CALLS:
        return this.convertToToolCalls(message);

      default:
        return message;
    }
  }

  private convertToStringContent(message: Message): Message {
    let content = '';

    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join(' ');
    } else if (message.parts) {
      content = message.parts
        .filter((part) => 'text' in part)
        .map((part) => part.text)
        .join(' ');
    }

    return {
      role: message.role,
      content: content.trim(),
      _compositionType: MessageShape.STRING_CONTENT,
    };
  }

  private convertToPartsArray(message: Message): Message {
    const parts: MessagePart[] = [];

    if (typeof message.content === 'string') {
      parts.push({ text: message.content });
    } else if (Array.isArray(message.content)) {
      message.content.forEach((block) => {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        }
      });
    }

    return {
      role: message.role,
      parts,
      _compositionType: MessageShape.PARTS_ARRAY,
    };
  }

  private convertToContentBlocks(message: Message): Message {
    const content: ContentBlock[] = [];

    if (typeof message.content === 'string') {
      content.push({ type: 'text', text: message.content });
    } else if (message.parts) {
      message.parts.forEach((part) => {
        if ('text' in part) {
          content.push({ type: 'text', text: part.text });
        }
      });
    }

    return {
      role: message.role,
      content,
      _compositionType: MessageShape.ARRAY_CONTENT,
    };
  }

  private convertToToolCalls(message: Message): Message {
    // Tool calls conversion is more complex and depends on the specific use case
    return {
      ...message,
      tool_calls: message.tool_calls || [],
      _compositionType: MessageShape.TOOL_CALLS,
    };
  }
}
