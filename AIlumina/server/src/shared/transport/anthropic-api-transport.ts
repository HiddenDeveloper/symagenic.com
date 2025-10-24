/**
 * Anthropic API Transport
 *
 * Handles Anthropic Claude API communication using direct HTTP.
 * Responsible ONLY for HTTP transport, not message composition.
 * No SDK dependencies - pure fetch-based implementation.
 */

import { Message } from '../types/message-types.js';
import { MESSAGE_ROLES } from '../constants/message-constants.js';
import { TransportResult, StreamingTransportResult } from '../types/transport-types.js';

/**
 * Anthropic API transport configuration
 */
export interface AnthropicTransportConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Transport for Anthropic Claude API using direct HTTP
 * No SDK dependencies - pure fetch-based implementation
 */
export class AnthropicAPITransport {
  private config: AnthropicTransportConfig;
  private abortController?: AbortController;

  constructor(config: AnthropicTransportConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.anthropic.com',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 2,
    };
  }

  /**
   * Send messages to Anthropic Claude API
   */
  async send(
    messages: Message[],
    options: {
      tools?: unknown[];
      systemPrompt?: string;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<TransportResult> {
    // Prepare Anthropic format
    const anthropicMessages = this.prepareAnthropicFormat(messages);

    // Build request parameters
    const requestParams: Record<string, unknown> = {
      model: this.config.model,
      messages: anthropicMessages,
      max_tokens: options.maxTokens || 4096,
    };

    // Add system prompt if provided
    if (options.systemPrompt) {
      requestParams.system = options.systemPrompt;
    }

    // Add tools
    if (options.tools && options.tools.length > 0) {
      requestParams.tools = options.tools;
    }

    // Add temperature
    if (options.temperature !== undefined) {
      requestParams.temperature = options.temperature;
    }

    // Handle streaming vs non-streaming
    if (options.stream) {
      requestParams.stream = true;
      return await this.sendStreaming(requestParams);
    } else {
      return await this.sendNonStreaming(requestParams);
    }
  }

  /**
   * Send non-streaming request using direct HTTP
   */
  private async sendNonStreaming(requestParams: Record<string, unknown>): Promise<TransportResult> {
    const url = `${this.config.baseUrl}/v1/messages`;

    let retries = 0;
    while (retries <= this.config.maxRetries!) {
      try {
        this.abortController = new AbortController();
        const timeoutId = setTimeout(() => this.abortController?.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify(requestParams),
          signal: this.abortController.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        return {
          type: 'non_streaming',
          data: data,
          raw: data,
        };
      } catch (error: unknown) {
        retries++;
        if (retries > this.config.maxRetries!) {
          throw new Error(
            `Anthropic API transport error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Send streaming request using direct HTTP with Server-Sent Events
   */
  private async sendStreaming(
    requestParams: Record<string, unknown>
  ): Promise<StreamingTransportResult> {
    const url = `${this.config.baseUrl}/v1/messages`;

    try {
      this.abortController = new AbortController();

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(requestParams),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Create async iterator for the stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      const stream = this.createAsyncIterator(reader, decoder);

      return {
        type: 'streaming',
        stream: stream,
      };
    } catch (error) {
      throw new Error(
        `Anthropic API streaming transport error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create async iterator for streaming responses
   */
  private async *createAsyncIterator(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: InstanceType<typeof TextDecoder>
  ) {
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine === '') continue;

          if (trimmedLine.startsWith('data: ')) {
            const jsonStr = trimmedLine.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const chunk = JSON.parse(jsonStr) as unknown;
              yield chunk;
            } catch (e) {
              console.error('Error parsing SSE chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Build HTTP headers for the request
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'tools-2024-04-04',
    };
  }

  /**
   * Prepare messages for Anthropic's format
   * This is transport-specific format conversion, not composition
   */
  private prepareAnthropicFormat(messages: Message[]): unknown[] {
    const anthropicMessages: unknown[] = [];

    for (const message of messages) {
      // Skip system messages as they go in the system field
      if (message.role === MESSAGE_ROLES.SYSTEM) {
        continue;
      }

      const anthropicMessage: Record<string, unknown> = {
        role: message.role === MESSAGE_ROLES.TOOL ? MESSAGE_ROLES.USER : message.role,
      };

      // Handle different message shapes
      if (Array.isArray(message.content)) {
        // Already in Anthropic content blocks format
        anthropicMessage.content = message.content;
      } else if (message.tool_call_id) {
        // Tool response - convert to content blocks
        anthropicMessage.content = [
          {
            type: 'tool_result',
            tool_use_id: message.tool_call_id,
            content: message.content || '',
          },
        ];
      } else if (message.tool_calls) {
        // Tool calls from other format - convert to Anthropic format
        const contentBlocks: unknown[] = [];

        // Add any text content first
        if (message.content) {
          contentBlocks.push({
            type: 'text',
            text: message.content,
          });
        }

        // Add tool use blocks
        for (const toolCall of message.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function?.name || toolCall.name,
            input: toolCall.function?.arguments
              ? (JSON.parse(toolCall.function.arguments) as unknown)
              : toolCall.args || {},
          });
        }

        anthropicMessage.content = contentBlocks;
      } else if (typeof message.content === 'string') {
        // String content - wrap in text block for consistency
        anthropicMessage.content = [
          {
            type: 'text',
            text: message.content,
          },
        ];
      } else if (message.parts) {
        // Google parts format - convert to Anthropic blocks
        const contentBlocks: unknown[] = [];

        for (const part of message.parts) {
          if ('text' in part) {
            contentBlocks.push({
              type: 'text',
              text: part.text,
            });
          }
        }

        anthropicMessage.content = contentBlocks;
      } else {
        // Fallback to empty text block
        anthropicMessage.content = [
          {
            type: 'text',
            text: '',
          },
        ];
      }

      anthropicMessages.push(anthropicMessage);
    }

    return anthropicMessages;
  }

  /**
   * Test connection to Anthropic API
   */
  async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/v1/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: MESSAGE_ROLES.USER, content: 'Hello' }],
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      await response.json();

      return {
        success: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): Promise<unknown> {
    // Anthropic doesn't have a model info endpoint
    // Return basic info
    return Promise.resolve({
      model: this.config.model,
      provider: 'anthropic',
      supportsStreaming: true,
      supportsTools: true,
      baseUrl: this.config.baseUrl,
    });
  }

  /**
   * Convert Anthropic response to standardized format
   */
  parseResponse(response: TransportResult): {
    content?: string;
    stopReason?: string;
    toolUse?: unknown[];
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  } {
    const result: {
      content?: string;
      stopReason?: string;
      toolUse?: unknown[];
      usage?: {
        inputTokens: number;
        outputTokens: number;
      };
    } = {};

    if (response.type === 'non_streaming' && response.data) {
      // Type guard for response data
      const data = response.data as unknown;
      if (data && typeof data === 'object') {
        const dataObj = data as {
          content?: unknown;
          stop_reason?: unknown;
          usage?: unknown;
        };

        // Extract content with type checking
        if (dataObj.content && Array.isArray(dataObj.content)) {
          // Extract text from content blocks with type guards
          const textBlocks = dataObj.content.filter(
            (block: unknown) =>
              block &&
              typeof block === 'object' &&
              'type' in block &&
              (block as { type: unknown }).type === 'text'
          );
          if (textBlocks.length > 0) {
            const texts = textBlocks
              .map((block: unknown) => {
                if (block && typeof block === 'object' && 'text' in block) {
                  const text = (block as { text: unknown }).text;
                  return typeof text === 'string' ? text : '';
                }
                return '';
              })
              .filter((text) => text.length > 0);
            if (texts.length > 0) {
              result.content = texts.join('');
            }
          }

          // Extract tool use blocks with type guards
          const toolUseBlocks = dataObj.content.filter(
            (block: unknown) =>
              block &&
              typeof block === 'object' &&
              'type' in block &&
              (block as { type: unknown }).type === 'tool_use'
          );
          if (toolUseBlocks.length > 0) {
            result.toolUse = toolUseBlocks;
          }
        }

        // Extract stop reason with type checking
        if (dataObj.stop_reason && typeof dataObj.stop_reason === 'string') {
          result.stopReason = dataObj.stop_reason;
        }

        // Extract usage with type checking
        if (dataObj.usage && typeof dataObj.usage === 'object') {
          const usage = dataObj.usage as {
            input_tokens?: unknown;
            output_tokens?: unknown;
          };
          result.usage = {
            inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : 0,
            outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
          };
        }
      }
    }

    return result;
  }

  /**
   * Process streaming response
   */
  async processStreamingResponse(
    streamingResult: TransportResult,
    onChunk?: (chunk: { text?: string; toolUse?: unknown[]; stopReason?: string }) => void
  ): Promise<{
    fullText: string;
    toolUse: unknown[];
    usage?: unknown;
    stopReason?: string;
  }> {
    let fullText = '';
    const toolUseBlocks: unknown[] = [];
    let finalUsage;
    let stopReason;

    // Type guard for streaming result
    if (streamingResult.type !== 'streaming' || !('stream' in streamingResult)) {
      throw new Error('Expected streaming transport result');
    }

    const streamResult = streamingResult as { stream: AsyncIterable<unknown> };
    for await (const rawEvent of streamResult.stream) {
      // Type guard for event structure
      const event = rawEvent;
      if (!event || typeof event !== 'object') continue;

      const eventObj = event as {
        type?: unknown;
        content_block?: unknown;
        delta?: unknown;
        index?: unknown;
        usage?: unknown;
      };

      if (eventObj.type === 'content_block_start') {
        if (eventObj.content_block && typeof eventObj.content_block === 'object') {
          const contentBlock = eventObj.content_block as {
            type?: unknown;
            id?: unknown;
            name?: unknown;
          };
          if (contentBlock.type === 'tool_use') {
            toolUseBlocks.push({
              type: 'tool_use',
              id: typeof contentBlock.id === 'string' ? contentBlock.id : '',
              name: typeof contentBlock.name === 'string' ? contentBlock.name : '',
              input: {},
            } as Record<string, unknown>);
          }
        }
      } else if (eventObj.type === 'content_block_delta') {
        if (eventObj.delta && typeof eventObj.delta === 'object') {
          const delta = eventObj.delta as {
            type?: unknown;
            text?: unknown;
            partial_json?: unknown;
          };
          if (delta.type === 'text_delta' && typeof delta.text === 'string') {
            const text = delta.text;
            fullText += text;

            if (onChunk) {
              onChunk({ text });
            }
          } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
            // Accumulate tool input JSON
            const toolIndex =
              typeof eventObj.index === 'number' ? eventObj.index : toolUseBlocks.length - 1;
            if (toolUseBlocks[toolIndex]) {
              const toolBlock = toolUseBlocks[toolIndex] as Record<string, unknown>;
              const currentInput = typeof toolBlock.input === 'string' ? toolBlock.input : '';
              toolBlock.input = currentInput + delta.partial_json;
            }
          }
        }
      } else if (eventObj.type === 'content_block_stop') {
        // Parse accumulated JSON for tool use
        const toolIndex =
          typeof eventObj.index === 'number' ? eventObj.index : toolUseBlocks.length - 1;
        if (toolUseBlocks[toolIndex]) {
          const toolBlock = toolUseBlocks[toolIndex] as Record<string, unknown>;
          if (typeof toolBlock.input === 'string') {
            try {
              toolBlock.input = JSON.parse(toolBlock.input) as unknown;
            } catch (e) {
              console.error('Error parsing tool input JSON:', e);
            }
          }
        }
      } else if (eventObj.type === 'message_delta') {
        if (eventObj.delta && typeof eventObj.delta === 'object') {
          const delta = eventObj.delta as {
            stop_reason?: unknown;
          };
          if (typeof delta.stop_reason === 'string') {
            stopReason = delta.stop_reason;
          }
        }
        if (eventObj.usage && typeof eventObj.usage === 'object') {
          const usage = eventObj.usage as {
            input_tokens?: unknown;
            output_tokens?: unknown;
          };
          finalUsage = {
            inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : 0,
            outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
          };
        }
      } else if (eventObj.type === 'message_stop') {
        // Final message stop event
        if (onChunk && toolUseBlocks.length > 0) {
          onChunk({ toolUse: toolUseBlocks, stopReason });
        }
      }
    }

    return {
      fullText,
      toolUse: toolUseBlocks,
      usage: finalUsage,
      stopReason,
    };
  }

  /**
   * Update transport configuration
   */
  updateConfig(updates: Partial<AnthropicTransportConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Cancel ongoing request
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }
  }
}
