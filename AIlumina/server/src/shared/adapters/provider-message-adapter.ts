/**
 * Provider Message Adapter
 *
 * Bridges existing provider classes with the new shape-driven message architecture.
 * Uses the universal shape composer for consistent message handling across all providers.
 */

import { MessageShapeComposer, DetectedShape } from '../composition/message-shape-composer.js';
import {
  SERVICE_PROVIDERS,
  ServiceProvider,
  MESSAGE_ROLES,
  MessageRole,
} from '../constants/message-constants.js';
import {
  Message,
  MessageValidationResult,
  MessageShape,
  ContentBlock,
  MessagePart,
} from '../types/message-types.js';
import type { ToolCall } from '../types/index.js';
import { MessageBuilder } from '../composition/message-shape-builders.js';

/**
 * Adapter configuration options
 */
export interface ProviderMessageAdapterConfig {
  serviceProvider: ServiceProvider;
  enableValidation?: boolean;
  enableLogging?: boolean;
  strictMode?: boolean; // Fail on validation warnings in strict mode
}

/**
 * Adapter for bridging providers with shape-driven message composition
 */
export class ProviderMessageAdapter {
  private shapeComposer: MessageShapeComposer;
  private config: ProviderMessageAdapterConfig;
  private serviceProvider: ServiceProvider;

  constructor(config: ProviderMessageAdapterConfig) {
    this.config = {
      enableValidation: true,
      enableLogging: false,
      strictMode: false,
      ...config,
    };

    this.serviceProvider = config.serviceProvider;
    this.shapeComposer = new MessageShapeComposer();

    if (this.config.enableLogging) {
      console.log(
        `📎 Created ProviderMessageAdapter for ${config.serviceProvider} using shape composer`
      );
    }
  }

  /**
   * Format messages using shape-driven composition
   * Universal method that works for all providers
   */
  formatMessagesForProvider(messages: Message[]): Message[] {
    if (this.config.enableLogging) {
      console.log(`🔄 Composing ${messages.length} messages using shape composer`);
    }

    // Validate messages if enabled
    if (this.config.enableValidation) {
      const validationResults = this.validateMessages(messages);

      if (
        this.config.strictMode &&
        validationResults.some((r) => !r.isValid || r.warnings.length > 0)
      ) {
        const errors = validationResults.flatMap((r) => r.errors);
        const warnings = validationResults.flatMap((r) => r.warnings);
        throw new Error(`Message validation failed: ${[...errors, ...warnings].join(', ')}`);
      }
    }

    // Use shape composer to format messages
    return messages.map((msg) => this.shapeComposer.compose(msg));
  }

  /**
   * Format a tool response message using shape-driven builders
   * Universal method that auto-detects appropriate format
   */
  formatToolResponse(
    toolName: string,
    result: unknown,
    context: {
      toolCallId?: string;
      toolUseId?: string;
      preferredFormat?: 'auto' | 'parts' | 'content_blocks' | 'tool_calls';
    } = {}
  ): Message {
    if (this.config.enableLogging) {
      console.log(`🛠️  Formatting tool response for ${toolName} using universal builder`);
    }

    // Use universal message builder
    const response = MessageBuilder.toolResponse(toolName, result, {
      toolCallId: context.toolCallId,
      toolUseId: context.toolUseId,
      format: context.preferredFormat || 'auto',
    });

    // Validate the response
    if (this.config.enableValidation) {
      const validation = this.shapeComposer.validate(response);

      if (!validation.isValid) {
        console.error(`❌ Invalid tool response: ${validation.errors.join(', ')}`);

        if (this.config.strictMode) {
          throw new Error(`Invalid tool response: ${validation.errors.join(', ')}`);
        }
      }
    }

    return response;
  }

  /**
   * Format a tool call message using shape-driven builders
   * Universal method that auto-detects appropriate format
   */
  formatToolCall(
    toolName: string,
    toolArgs: Record<string, unknown>,
    context: {
      text?: string;
      preferredFormat?: 'auto' | 'parts' | 'content_blocks' | 'tool_calls';
      toolId?: string;
    } = {}
  ): Message {
    if (this.config.enableLogging) {
      console.log(`📞 Formatting tool call for ${toolName} using universal builder`);
    }

    // Use universal message builder
    const toolCall = MessageBuilder.toolCall(toolName, toolArgs, {
      text: context.text,
      format: context.preferredFormat || 'auto',
      toolId: context.toolId,
    });

    // Validate the tool call
    if (this.config.enableValidation) {
      const validation = this.shapeComposer.validate(toolCall);

      if (!validation.isValid) {
        console.error(`❌ Invalid tool call: ${validation.errors.join(', ')}`);

        if (this.config.strictMode) {
          throw new Error(`Invalid tool call: ${validation.errors.join(', ')}`);
        }
      }
    }

    return toolCall;
  }

  /**
   * Validate an array of messages using shape composer
   */
  validateMessages(messages: Message[]): MessageValidationResult[] {
    return messages.map((msg) => this.shapeComposer.validate(msg));
  }

  /**
   * Validate a single message using shape composer
   */
  validateMessage(message: Message): MessageValidationResult {
    return this.shapeComposer.validate(message);
  }

  /**
   * Detect message shape
   */
  detectMessageShape(message: Message): DetectedShape {
    return this.shapeComposer.detectShape(message);
  }

  /**
   * Convert legacy message format to new Message interface
   */
  convertLegacyMessage(legacyMessage: Record<string, unknown>): Message {
    if (this.config.enableLogging) {
      console.log('🔄 Converting legacy message format');
    }

    // Handle basic structure
    const message: Message = {
      role: (legacyMessage.role as MessageRole) || MESSAGE_ROLES.USER,
    };

    // Handle content variations
    if (typeof legacyMessage.content === 'string') {
      message.content = legacyMessage.content;
    } else if (Array.isArray(legacyMessage.content)) {
      message.content = legacyMessage.content;
    } else if (legacyMessage.parts && Array.isArray(legacyMessage.parts)) {
      // Google format
      message.parts = legacyMessage.parts as MessagePart[];
    } else if (legacyMessage.tool_calls && Array.isArray(legacyMessage.tool_calls)) {
      // OpenAI format
      message.tool_calls = legacyMessage.tool_calls as ToolCall[];
    }

    // Handle tool-specific fields
    if (typeof legacyMessage.tool_call_id === 'string') {
      message.tool_call_id = legacyMessage.tool_call_id;
    }

    if (typeof legacyMessage.name === 'string') {
      message.name = legacyMessage.name;
    }

    return message;
  }

  /**
   * Parse provider response and extract relevant parts
   */
  parseProviderResponse(response: unknown): {
    content?: string;
    toolCalls?: { name: string; args: Record<string, unknown> }[];
    parts?: MessagePart[];
    contentBlocks?: ContentBlock[];
  } {
    const result: {
      content?: string;
      toolCalls?: { name: string; args: Record<string, unknown> }[];
      parts?: MessagePart[];
      contentBlocks?: ContentBlock[];
    } = {};

    // Handle different response formats
    if (typeof response === 'string') {
      result.content = response;
    } else if (response && typeof response === 'object') {
      const resp = response as Record<string, unknown>;

      if (resp.content) {
        if (typeof resp.content === 'string') {
          result.content = resp.content;
        } else if (Array.isArray(resp.content)) {
          result.contentBlocks = resp.content as ContentBlock[];
          // Extract text content
          result.content = (resp.content as ContentBlock[])
            .filter((block: ContentBlock) => block.type === 'text')
            .map((block: ContentBlock) => block.text)
            .join(' ');
        }
      }

      // Extract tool calls (OpenAI format)
      if (resp.tool_calls && Array.isArray(resp.tool_calls)) {
        result.toolCalls = resp.tool_calls as { name: string; args: Record<string, unknown> }[];
      }

      // Extract parts (Google format)
      if (resp.parts && Array.isArray(resp.parts)) {
        result.parts = resp.parts as MessagePart[];

        // Extract text from parts
        if (!result.content) {
          result.content = (resp.parts as MessagePart[])
            .filter((part: MessagePart) => part.text)
            .map((part: MessagePart) => part.text)
            .join(' ');
        }

        // Extract function calls from Google parts
        const functionCalls = (resp.parts as MessagePart[]).filter((part: MessagePart) => {
          const p = part as Record<string, unknown>;
          return p.functionCall !== undefined;
        });
        if (functionCalls.length > 0) {
          result.toolCalls = functionCalls.map((part: MessagePart) => {
            const p = part as Record<string, unknown>;
            const funcCall = p.functionCall as Record<string, unknown>;
            return {
              name: funcCall.name as string,
              args: funcCall.args as Record<string, unknown>,
            };
          });
        }
      }
    }

    return result;
  }

  /**
   * Create a complete tool execution flow (call + response)
   */
  createToolExecutionFlow(
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolResult: unknown,
    assistantText?: string
  ): Message[] {
    const messages: Message[] = [];

    // Create tool call message
    const toolCallMessage = this.formatToolCall(toolName, toolArgs, { text: assistantText });
    messages.push(toolCallMessage);

    // Extract tool ID based on detected shape
    const shape = this.shapeComposer.detectShape(toolCallMessage);
    let toolId = '';

    switch (shape.shape) {
      case MessageShape.PARTS_ARRAY:
        // Google doesn't use tool IDs in the same way
        toolId = toolName;
        break;

      case MessageShape.ARRAY_CONTENT:
        if (toolCallMessage.content && Array.isArray(toolCallMessage.content)) {
          const toolUseBlock = toolCallMessage.content.find(
            (block: ContentBlock) => block.type === 'tool_use'
          );
          toolId = (toolUseBlock?.id as string) || '';
        }
        break;

      case MessageShape.TOOL_CALLS:
        if (toolCallMessage.tool_calls && toolCallMessage.tool_calls.length > 0) {
          toolId = toolCallMessage.tool_calls[0].id || '';
        }
        break;

      default:
        toolId = toolName;
        break;
    }

    // Create tool response message
    const toolResponseMessage = this.formatToolResponse(toolName, toolResult, {
      toolCallId: toolId,
      toolUseId: toolId,
    });
    messages.push(toolResponseMessage);

    return messages;
  }

  /**
   * Get provider metadata
   */
  getProviderMetadata(): {
    name: string;
    version: string;
    capabilities: string[];
    limitations: string[];
  } {
    return {
      name: this.serviceProvider,
      version: '1.0.0',
      capabilities: ['shape-driven-composition', 'universal-format'],
      limitations: [],
    };
  }

  /**
   * Check if a message shape is supported by the provider
   */
  isShapeSupported(shape: MessageShape): boolean {
    // All shapes are supported through shape composer
    return Object.values(MessageShape).includes(shape);
  }

  /**
   * Get the underlying shape composer (for advanced usage)
   */
  getShapeComposer(): MessageShapeComposer {
    return this.shapeComposer;
  }

  /**
   * Update adapter configuration
   */
  updateConfig(config: Partial<ProviderMessageAdapterConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.serviceProvider && config.serviceProvider !== this.serviceProvider) {
      // Update service provider
      this.serviceProvider = config.serviceProvider;
    }
  }
}

/**
 * Factory function for creating adapters
 */
export function createProviderAdapter(
  serviceProvider: ServiceProvider,
  options?: Partial<ProviderMessageAdapterConfig>
): ProviderMessageAdapter {
  return new ProviderMessageAdapter({
    serviceProvider,
    ...options,
  });
}

/**
 * Get adapter for current environment
 */
export function getAdapterForEnvironment(): ProviderMessageAdapter | null {
  // Determine provider from environment
  let serviceProvider: ServiceProvider | null = null;

  if (process.env.SERVICE_PROVIDER) {
    const provider = process.env.SERVICE_PROVIDER.toUpperCase();
    if (Object.values(SERVICE_PROVIDERS).includes(provider as ServiceProvider)) {
      serviceProvider = provider as ServiceProvider;
    }
  } else if (process.env.GOOGLE_API_KEY) {
    serviceProvider = SERVICE_PROVIDERS.GOOGLE;
  } else if (process.env.ANTHROPIC_API_KEY) {
    serviceProvider = SERVICE_PROVIDERS.ANTHROPIC;
  } else if (process.env.OPENAI_API_KEY) {
    serviceProvider = SERVICE_PROVIDERS.OPENAI;
  } else if (process.env.GROQ_API_KEY) {
    serviceProvider = SERVICE_PROVIDERS.GROQ;
  }

  if (!serviceProvider) {
    return null;
  }

  return createProviderAdapter(serviceProvider, {
    enableLogging: process.env.ENABLE_ADAPTER_LOGGING === 'true',
    enableValidation: process.env.ENABLE_MESSAGE_VALIDATION !== 'false',
    strictMode: process.env.STRICT_MESSAGE_VALIDATION === 'true',
  });
}
