/**
 * OpenAI API Transport
 *
 * Handles OpenAI-compatible API communication using direct HTTP.
 * Responsible ONLY for HTTP transport, not message composition.
 * Works with OpenAI, LMStudio, Groq, and other OpenAI-compatible APIs.
 */

import { Message } from '../types/message-types.js';
import { MESSAGE_ROLES } from '../constants/message-constants.js';

/**
 * OpenAI API transport configuration
 */
export interface OpenAITransportConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  organization?: string;
}

/**
 * Transport for OpenAI-compatible APIs using direct HTTP
 * No SDK dependencies - pure fetch-based implementation
 */
export class OpenAIAPITransport {
  private config: OpenAITransportConfig;
  private abortController?: AbortController;

  constructor(config: OpenAITransportConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 2,
    };
  }

  /**
   * Send messages to OpenAI-compatible API
   */
  async send(
    messages: Message[],
    options: {
      tools?: unknown[];
      systemPrompt?: string;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
      toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    } = {}
  ): Promise<unknown> {
    console.log('🌐 [OpenAITransport] send() called');
    console.log('  - Base URL:', this.config.baseUrl);
    console.log('  - Model:', this.config.model);
    console.log('  - Messages count:', messages.length);
    console.log('  - Has system prompt:', !!options.systemPrompt);
    console.log('  - Stream:', options.stream);

    // Prepare OpenAI format
    const openaiMessages = this.prepareOpenAIFormat(messages, options.systemPrompt);
    console.log('  - Prepared messages count:', openaiMessages.length);

    // Build request parameters
    const requestParams: Record<string, unknown> = {
      model: this.config.model,
      messages: openaiMessages,
    };

    // Add tools
    if (options.tools && options.tools.length > 0) {
      requestParams.tools = options.tools;
      requestParams.tool_choice = options.toolChoice || 'auto';
    }

    // Add temperature - some models only support default temperature of 1
    if (options.temperature !== undefined) {
      // Models like gpt-5-nano only support the default temperature value of 1
      const temperatureRestrictedModels = ['gpt-5-nano', 'o1', 'o3'];
      const hasTemperatureRestriction = temperatureRestrictedModels.some(model => 
        this.config.model.includes(model)
      );
      
      if (hasTemperatureRestriction) {
        // Omit temperature parameter to use default value of 1
        // requestParams.temperature = 1; // Could explicitly set to 1 if needed
      } else {
        requestParams.temperature = options.temperature;
      }
    }

    // Add max tokens - use max_completion_tokens for newer models
    if (options.maxTokens) {
      // Check if this is a newer model that requires max_completion_tokens
      const isNewerModel = this.config.model.includes('gpt-4') || 
                           this.config.model.includes('gpt-5') || 
                           this.config.model.includes('o1') ||
                           this.config.model.includes('o3');
      
      if (isNewerModel) {
        requestParams.max_completion_tokens = options.maxTokens;
      } else {
        requestParams.max_tokens = options.maxTokens;
      }
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
  private async sendNonStreaming(requestParams: Record<string, unknown>): Promise<unknown> {
    const url = `${this.config.baseUrl}/chat/completions`;
    console.log('📨 [OpenAITransport] Sending non-streaming request');
    console.log('  - URL:', url);
    console.log('  - Request body:', JSON.stringify(requestParams, null, 2));

    let retries = 0;
    while (retries <= this.config.maxRetries!) {
      try {
        this.abortController = new AbortController();
        const timeoutId = setTimeout(() => this.abortController?.abort(), this.config.timeout);

        const headers = this.buildHeaders();
        console.log('  - Headers:', JSON.stringify(headers, null, 2));

        const response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestParams),
          signal: this.abortController.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [OpenAITransport] HTTP Error');
          console.error('  - Status:', response.status);
          console.error('  - Status Text:', response.statusText);
          console.error('  - Error Body:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ [OpenAITransport] Success');
        console.log('  - Response preview:', JSON.stringify(data, null, 2).substring(0, 300));

        return {
          type: 'non_streaming',
          data: data,
          raw: data,
        };
      } catch (error: unknown) {
        console.error(
          `⚠️ [OpenAITransport] Request failed (attempt ${retries + 1}/${this.config.maxRetries! + 1})`
        );
        console.error('  - Error:', error instanceof Error ? error.message : String(error));

        retries++;
        if (retries > this.config.maxRetries!) {
          console.error('❌ [OpenAITransport] Max retries exceeded');
          throw new Error(
            `OpenAI API transport error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        // Wait before retry
        console.log(`  - Waiting ${1000 * retries}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Send streaming request using direct HTTP with Server-Sent Events
   */
  private async sendStreaming(requestParams: Record<string, unknown>): Promise<unknown> {
    const url = `${this.config.baseUrl}/chat/completions`;

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
        response: null,
      };
    } catch (error) {
      throw new Error(
        `OpenAI API streaming transport error: ${error instanceof Error ? error.message : String(error)}`
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
          if (trimmedLine === '' || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    return headers;
  }

  /**
   * Prepare messages for OpenAI's format
   * This is transport-specific format conversion, not composition
   */
  private prepareOpenAIFormat(messages: Message[], systemPrompt?: string): unknown[] {
    console.log('🔄 [OpenAITransport] Preparing messages for OpenAI format');
    const openaiMessages: unknown[] = [];

    // Add system prompt if provided and not already in messages
    if (systemPrompt) {
      const hasSystemMessage = messages.some((msg) => msg.role === MESSAGE_ROLES.SYSTEM);
      console.log('  - Has system prompt:', true);
      console.log('  - Already has system message:', hasSystemMessage);
      console.log('  - System prompt preview:', systemPrompt.substring(0, 100));

      if (!hasSystemMessage) {
        openaiMessages.push({
          role: MESSAGE_ROLES.SYSTEM,
          content: systemPrompt,
        });
      }
    }

    for (let index = 0; index < messages.length; index++) {
      const message = messages[index];
      console.log(`  - Processing message ${index + 1}:`);
      console.log(`    Role: ${message.role}`);
      console.log(`    Content type: ${typeof message.content}`);
      console.log(`    Has tool_calls: ${!!message.tool_calls}`);
      console.log(`    Has tool_call_id: ${!!message.tool_call_id}`);
      console.log(`    Has parts: ${!!message.parts}`);

      const openaiMessage: Record<string, unknown> = {
        role: message.role,
      };

      // Handle different message shapes
      if (message.tool_calls) {
        // Already in tool_calls format - direct use
        openaiMessage.tool_calls = message.tool_calls;

        // Add content if present
        if (message.content) {
          openaiMessage.content = message.content;
        }
      } else if (message.tool_call_id) {
        // Tool response message
        openaiMessage.tool_call_id = message.tool_call_id;
        openaiMessage.content = message.content || '';

        if (message.name) {
          openaiMessage.name = message.name;
        }
      } else if (typeof message.content === 'string') {
        // String content - direct use
        openaiMessage.content = message.content;
      } else if (Array.isArray(message.content)) {
        // Content blocks - convert to string for OpenAI
        const textContent = message.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join(' ');
        openaiMessage.content = textContent || '';

        // Check for tool use blocks and convert to tool calls
        const toolUseBlocks = message.content.filter((block) => block.type === 'tool_use');
        if (toolUseBlocks.length > 0) {
          openaiMessage.tool_calls = toolUseBlocks.map((block) => ({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input || {}),
            },
          }));
        }
      } else if (message.parts) {
        // Parts format - convert to string content
        const textContent = message.parts
          .filter((part) => 'text' in part)
          .map((part) => part.text)
          .join(' ');
        openaiMessage.content = textContent || '';

        // Check for function calls and convert to tool calls
        const functionCalls = message.parts.filter((part) => 'functionCall' in part);
        if (functionCalls.length > 0) {
          openaiMessage.tool_calls = functionCalls.map((part) => ({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: (part as { functionCall: { name: string; args?: unknown } }).functionCall.name,
              arguments: JSON.stringify(
                (part as { functionCall: { name: string; args?: unknown } }).functionCall.args || {}
              ),
            },
          }));
        }
      } else {
        // Fallback to empty content
        openaiMessage.content = '';
      }

      openaiMessages.push(openaiMessage);
    }

    console.log('  - Final prepared messages count:', openaiMessages.length);
    console.log('  - Final messages structure:', JSON.stringify(openaiMessages, null, 2));

    return openaiMessages;
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/chat/completions`;

      // Prepare request body with correct token parameter
      const isNewerModel = this.config.model.includes('gpt-4') || 
                           this.config.model.includes('gpt-5') || 
                           this.config.model.includes('o1') ||
                           this.config.model.includes('o3');

      const requestBody: Record<string, unknown> = {
        model: this.config.model,
        messages: [{ role: MESSAGE_ROLES.USER, content: 'Hello' }],
      };

      if (isNewerModel) {
        requestBody.max_completion_tokens = 10;
      } else {
        requestBody.max_tokens = 10;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(requestBody),
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
    // Most OpenAI-compatible APIs don't support model retrieval
    // Return basic info
    return Promise.resolve({
      model: this.config.model,
      provider: 'openai_compatible',
      supportsStreaming: true,
      supportsTools: true,
      baseUrl: this.config.baseUrl,
    });
  }

  /**
   * Convert OpenAI response to standardized format
   */
  parseResponse(response: unknown): {
    content?: string;
    toolCalls?: unknown[];
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    finishReason?: string;
  } {
    const result: {
      content?: string;
      toolCalls?: unknown[];
      usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
      finishReason?: string;
    } = {};

    // Type guard for response structure
    if (response && typeof response === 'object' && 'data' in response) {
      const responseObj = response as { data?: unknown };
      const data = responseObj.data;

      if (data && typeof data === 'object') {
        const dataObj = data as { choices?: unknown[]; usage?: unknown };

        if (Array.isArray(dataObj.choices) && dataObj.choices.length > 0) {
          const choice = dataObj.choices[0] as { message?: unknown; finish_reason?: string };

          if (choice.message && typeof choice.message === 'object') {
            const message = choice.message as { content?: string; tool_calls?: unknown[] };

            // Extract content
            if (typeof message.content === 'string') {
              result.content = message.content;
            }

            // Extract tool calls
            if (Array.isArray(message.tool_calls)) {
              result.toolCalls = message.tool_calls;
            }
          }

          // Extract finish reason
          if (typeof choice.finish_reason === 'string') {
            result.finishReason = choice.finish_reason;
          }
        }

        // Extract usage
        if (dataObj.usage && typeof dataObj.usage === 'object') {
          const usage = dataObj.usage as {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
          result.usage = {
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
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
    streamingResult: unknown,
    onChunk?: (chunk: { text?: string; toolCalls?: unknown[] }) => void
  ): Promise<{
    fullText: string;
    toolCalls: unknown[];
    usage?: unknown;
  }> {
    let fullText = '';
    const toolCallsAccumulator: Record<
      string,
      { id: string; type: string; function: { name: string; arguments: string } }
    > = {};
    let finalUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;

    // Type guard for streaming result
    if (!streamingResult || typeof streamingResult !== 'object' || !('stream' in streamingResult)) {
      throw new Error('Invalid streaming result');
    }

    const streamingObj = streamingResult as { stream: AsyncIterable<unknown> };

    for await (const chunk of streamingObj.stream) {
      // Type guard for chunk structure
      if (!chunk || typeof chunk !== 'object') continue;

      const chunkObj = chunk as { choices?: unknown[]; usage?: unknown };

      if (Array.isArray(chunkObj.choices) && chunkObj.choices.length > 0) {
        const choice = chunkObj.choices[0] as { delta?: unknown };

        if (choice.delta && typeof choice.delta === 'object') {
          const delta = choice.delta as { content?: string; tool_calls?: unknown[] };

          if (typeof delta.content === 'string') {
            fullText += delta.content;

            if (onChunk) {
              onChunk({ text: delta.content });
            }
          }

          if (Array.isArray(delta.tool_calls)) {
            for (const toolCallDelta of delta.tool_calls) {
              if (toolCallDelta && typeof toolCallDelta === 'object') {
                const toolCall = toolCallDelta as {
                  id?: string;
                  type?: string;
                  function?: { name?: string; arguments?: string };
                };
                const id = toolCall.id;

                if (typeof id === 'string') {
                  if (!toolCallsAccumulator[id]) {
                    toolCallsAccumulator[id] = {
                      id,
                      type: toolCall.type || 'function',
                      function: {
                        name: '',
                        arguments: '',
                      },
                    };
                  }

                  if (toolCall.function?.name) {
                    toolCallsAccumulator[id].function.name += toolCall.function.name;
                  }
                  if (toolCall.function?.arguments) {
                    toolCallsAccumulator[id].function.arguments += toolCall.function.arguments;
                  }
                }
              }
            }
          }
        }
      }

      // Check for usage in final chunk
      if (chunkObj.usage && typeof chunkObj.usage === 'object') {
        const usage = chunkObj.usage as {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
        finalUsage = {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        };
      }
    }

    const toolCalls = Object.values(toolCallsAccumulator);

    if (toolCalls.length > 0 && onChunk) {
      onChunk({ toolCalls });
    }

    return {
      fullText,
      toolCalls,
      usage: finalUsage,
    };
  }

  /**
   * Update transport configuration
   */
  updateConfig(updates: Partial<OpenAITransportConfig>): void {
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
