/**
 * Message Shape Builders
 *
 * Utility functions for building messages in specific shapes.
 * Shape-driven builders, not provider-specific.
 */

import { Message, MessageShape, MessagePart, ContentBlock } from '../types/message-types.js';
import type { ToolCall } from '../types/index.js';
import { MESSAGE_ROLES, MessageRole } from '../constants/message-constants.js';

// Type definitions for Google-specific parts
interface GoogleFunctionCallPart extends MessagePart {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
}

interface GoogleFunctionResponsePart extends MessagePart {
  functionResponse: {
    name: string;
    response: unknown;
  };
}

/**
 * Build messages with parts[] shape (Google-style)
 */
export class PartsMessageBuilder {
  /**
   * Create a text message with parts[]
   */
  static text(role: MessageRole, text: string): Message {
    return {
      role,
      parts: [{ text }],
      _compositionType: MessageShape.PARTS_ARRAY,
    };
  }

  /**
   * Create a function call message with parts[]
   */
  static functionCall(toolName: string, args: Record<string, unknown>, text?: string): Message {
    const parts: (MessagePart | GoogleFunctionCallPart)[] = [];

    if (text) {
      parts.push({ text });
    }

    parts.push({
      functionCall: {
        name: toolName,
        args,
      },
    });

    return {
      role: MESSAGE_ROLES.ASSISTANT,
      parts,
      _compositionType: MessageShape.PARTS_ARRAY,
    };
  }

  /**
   * Create a function response message with parts[]
   */
  static functionResponse(toolName: string, result: unknown): Message {
    const responsePart: GoogleFunctionResponsePart = {
      functionResponse: {
        name: toolName,
        response: result,
      },
    };

    return {
      role: MESSAGE_ROLES.USER,
      parts: [responsePart],
      _compositionType: MessageShape.PARTS_ARRAY,
    };
  }

  /**
   * Create a multi-part message
   */
  static multiPart(role: MessageRole, parts: MessagePart[]): Message {
    return {
      role,
      parts,
      _compositionType: MessageShape.PARTS_ARRAY,
    };
  }
}

/**
 * Build messages with content[] blocks shape (Anthropic-style)
 */
export class ContentBlocksMessageBuilder {
  /**
   * Create a text message with content blocks
   */
  static text(role: MessageRole, text: string): Message {
    return {
      role,
      content: [{ type: 'text', text }],
      _compositionType: MessageShape.ARRAY_CONTENT,
    };
  }

  /**
   * Create a tool use message with content blocks
   */
  static toolUse(
    toolId: string,
    toolName: string,
    input: Record<string, unknown>,
    text?: string
  ): Message {
    const content: ContentBlock[] = [];

    if (text) {
      content.push({ type: 'text', text });
    }

    content.push({
      type: 'tool_use',
      id: toolId,
      name: toolName,
      input,
    });

    return {
      role: MESSAGE_ROLES.ASSISTANT,
      content,
      _compositionType: MessageShape.ARRAY_CONTENT,
    };
  }

  /**
   * Create a tool result message with content blocks
   */
  static toolResult(toolUseId: string, result: unknown): Message {
    return {
      role: MESSAGE_ROLES.USER,
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        },
      ],
      _compositionType: MessageShape.ARRAY_CONTENT,
    };
  }

  /**
   * Create a multi-block message
   */
  static multiBlock(role: MessageRole, blocks: ContentBlock[]): Message {
    return {
      role,
      content: blocks,
      _compositionType: MessageShape.ARRAY_CONTENT,
    };
  }

  /**
   * Create a mixed content message (text + tool use)
   */
  static textWithToolUse(
    text: string,
    toolId: string,
    toolName: string,
    input: Record<string, unknown>
  ): Message {
    return {
      role: MESSAGE_ROLES.ASSISTANT,
      content: [
        { type: 'text', text },
        { type: 'tool_use', id: toolId, name: toolName, input },
      ],
      _compositionType: MessageShape.ARRAY_CONTENT,
    };
  }
}

/**
 * Build messages with tool_calls[] shape (OpenAI-style)
 */
export class ToolCallsMessageBuilder {
  /**
   * Create a tool call message
   */
  static toolCall(toolCalls: ToolCall[], text?: string): Message {
    const message: Message = {
      role: MESSAGE_ROLES.ASSISTANT,
      tool_calls: toolCalls,
      _compositionType: MessageShape.TOOL_CALLS,
    };

    if (text) {
      message.content = text;
    }

    return message;
  }

  /**
   * Create a single tool call message
   */
  static singleToolCall(
    callId: string,
    toolName: string,
    args: Record<string, unknown>,
    text?: string
  ): Message {
    const toolCall: ToolCall = {
      id: callId,
      type: 'function' as const,
      function: {
        name: toolName,
        arguments: JSON.stringify(args),
      },
    };

    return this.toolCall([toolCall], text);
  }

  /**
   * Create a tool response message
   */
  static toolResponse(toolCallId: string, toolName: string, result: unknown): Message {
    return {
      role: MESSAGE_ROLES.TOOL,
      tool_call_id: toolCallId,
      name: toolName,
      content: typeof result === 'string' ? result : JSON.stringify(result),
      _compositionType: MessageShape.STRING_CONTENT, // Tool responses are string content
    };
  }

  /**
   * Generate a unique tool call ID
   */
  static generateToolCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Build simple string content messages (Universal)
 */
export class StringMessageBuilder {
  /**
   * Create a simple text message
   */
  static text(role: MessageRole, content: string): Message {
    return {
      role,
      content,
      _compositionType: MessageShape.STRING_CONTENT,
    };
  }

  /**
   * Create a tool response message (OpenAI-style)
   */
  static toolResponse(toolCallId: string, toolName: string, result: unknown): Message {
    return {
      role: MESSAGE_ROLES.TOOL,
      tool_call_id: toolCallId,
      name: toolName,
      content: typeof result === 'string' ? result : JSON.stringify(result),
      _compositionType: MessageShape.STRING_CONTENT,
    };
  }

  /**
   * Create a system message
   */
  static system(content: string): Message {
    return {
      role: MESSAGE_ROLES.SYSTEM,
      content,
      _compositionType: MessageShape.STRING_CONTENT,
    };
  }

  /**
   * Create a user message
   */
  static user(content: string): Message {
    return {
      role: MESSAGE_ROLES.USER,
      content,
      _compositionType: MessageShape.STRING_CONTENT,
    };
  }

  /**
   * Create an assistant message
   */
  static assistant(content: string): Message {
    return {
      role: MESSAGE_ROLES.ASSISTANT,
      content,
      _compositionType: MessageShape.STRING_CONTENT,
    };
  }
}

/**
 * Universal message builder that auto-detects best shape
 */
export class MessageBuilder {
  /**
   * Create the most appropriate message shape for tool responses
   */
  static toolResponse(
    toolName: string,
    result: unknown,
    context: {
      toolCallId?: string;
      toolUseId?: string;
      format?: 'parts' | 'content_blocks' | 'tool_calls' | 'auto';
    } = {}
  ): Message {
    const { toolCallId, toolUseId, format = 'auto' } = context;

    // Auto-detect format based on available identifiers
    if (format === 'auto') {
      if (toolUseId) {
        // Has tool_use_id → Anthropic content blocks format
        return ContentBlocksMessageBuilder.toolResult(toolUseId, result);
      } else if (toolCallId) {
        // Has tool_call_id → OpenAI tool response format
        return ToolCallsMessageBuilder.toolResponse(toolCallId, toolName, result);
      } else {
        // No specific ID → Google function response format
        return PartsMessageBuilder.functionResponse(toolName, result);
      }
    }

    // Explicit format requested
    switch (format) {
      case 'parts':
        return PartsMessageBuilder.functionResponse(toolName, result);

      case 'content_blocks':
        return ContentBlocksMessageBuilder.toolResult(toolUseId || 'unknown', result);

      case 'tool_calls':
        return ToolCallsMessageBuilder.toolResponse(toolCallId || 'unknown', toolName, result);

      default:
        return StringMessageBuilder.text(MESSAGE_ROLES.ASSISTANT, JSON.stringify(result));
    }
  }

  /**
   * Create the most appropriate message shape for tool calls
   */
  static toolCall(
    toolName: string,
    args: Record<string, unknown>,
    context: {
      text?: string;
      format?: 'parts' | 'content_blocks' | 'tool_calls' | 'auto';
      toolId?: string;
    } = {}
  ): Message {
    const { text, format = 'auto', toolId } = context;

    // For tool calls, default to content_blocks (most flexible)
    if (format === 'auto') {
      const id = toolId || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return ContentBlocksMessageBuilder.toolUse(id, toolName, args, text);
    }

    switch (format) {
      case 'parts':
        return PartsMessageBuilder.functionCall(toolName, args, text);

      case 'content_blocks': {
        const id = toolId || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return ContentBlocksMessageBuilder.toolUse(id, toolName, args, text);
      }

      case 'tool_calls': {
        const callId = toolId || ToolCallsMessageBuilder.generateToolCallId();
        return ToolCallsMessageBuilder.singleToolCall(callId, toolName, args, text);
      }

      default:
        return StringMessageBuilder.assistant(text || `Calling ${toolName}`);
    }
  }

  /**
   * Create a simple text message
   */
  static text(role: MessageRole, content: string): Message {
    return StringMessageBuilder.text(role, content);
  }
}

/**
 * Tool execution flow builders
 * Create complete request/response flows
 */
export class ToolFlowBuilder {
  /**
   * Create a complete tool execution flow (call + response)
   */
  static createFlow(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    format: 'parts' | 'content_blocks' | 'tool_calls' = 'content_blocks'
  ): [Message, Message] {
    let toolCall: Message;
    let toolResponse: Message;
    let toolId: string;

    switch (format) {
      case 'parts':
        toolCall = PartsMessageBuilder.functionCall(toolName, args);
        toolResponse = PartsMessageBuilder.functionResponse(toolName, result);
        break;

      case 'content_blocks':
        toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        toolCall = ContentBlocksMessageBuilder.toolUse(toolId, toolName, args);
        toolResponse = ContentBlocksMessageBuilder.toolResult(toolId, result);
        break;

      case 'tool_calls':
        toolId = ToolCallsMessageBuilder.generateToolCallId();
        toolCall = ToolCallsMessageBuilder.singleToolCall(toolId, toolName, args);
        toolResponse = ToolCallsMessageBuilder.toolResponse(toolId, toolName, result);
        break;
    }

    return [toolCall, toolResponse];
  }

  /**
   * Create a multi-tool execution flow
   */
  static createMultiToolFlow(
    tools: {
      name: string;
      args: Record<string, unknown>;
      result: unknown;
    }[],
    format: 'parts' | 'content_blocks' | 'tool_calls' = 'content_blocks'
  ): Message[] {
    const messages: Message[] = [];

    // Create tool calls with proper typing based on format
    let toolCalls: GoogleFunctionCallPart[] | ContentBlock[] | ToolCall[];

    switch (format) {
      case 'parts':
        toolCalls = tools.map((tool) => ({
          functionCall: { name: tool.name, args: tool.args },
        })) as GoogleFunctionCallPart[];
        messages.push(
          PartsMessageBuilder.multiPart(MESSAGE_ROLES.ASSISTANT, toolCalls as MessagePart[])
        );
        break;

      case 'content_blocks':
        toolCalls = tools.map((tool) => ({
          type: 'tool_use',
          id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: tool.name,
          input: tool.args,
        })) as ContentBlock[];
        messages.push(ContentBlocksMessageBuilder.multiBlock(MESSAGE_ROLES.ASSISTANT, toolCalls));
        break;

      case 'tool_calls': {
        const openAIToolCalls = tools.map((tool) => ({
          id: ToolCallsMessageBuilder.generateToolCallId(),
          type: 'function' as const,
          function: {
            name: tool.name,
            arguments: JSON.stringify(tool.args),
          },
        })) as ToolCall[];
        toolCalls = openAIToolCalls;
        messages.push(ToolCallsMessageBuilder.toolCall(openAIToolCalls));
        break;
      }
    }

    // Add tool responses
    tools.forEach((tool, index) => {
      switch (format) {
        case 'parts':
          messages.push(PartsMessageBuilder.functionResponse(tool.name, tool.result));
          break;

        case 'content_blocks': {
          const contentBlocks = toolCalls as ContentBlock[];
          const toolUseId = (contentBlocks[index]?.id as string) || `tool-${index}`;
          messages.push(ContentBlocksMessageBuilder.toolResult(toolUseId, tool.result));
          break;
        }

        case 'tool_calls': {
          const openAICalls = toolCalls as ToolCall[];
          const callId = openAICalls[index]?.id || `call-${index}`;
          messages.push(ToolCallsMessageBuilder.toolResponse(callId, tool.name, tool.result));
          break;
        }
      }
    });

    return messages;
  }
}
