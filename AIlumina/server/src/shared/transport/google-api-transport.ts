/**
 * Google API Transport
 *
 * Handles Google Gemini API communication using direct HTTP.
 * Responsible ONLY for HTTP transport, not message composition.
 * No SDK dependencies - pure fetch-based implementation.
 */

import { Message } from '../types/message-types.js';
import { MESSAGE_ROLES } from '../constants/message-constants.js';
// StreamingTransportResult removed as unused

/**
 * Google API transport configuration
 */
export interface GoogleTransportConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Transport for Google Gemini API using direct HTTP
 * No SDK dependencies - pure fetch-based implementation
 */
export class GoogleAPITransport {
  private config: GoogleTransportConfig;
  private abortController?: AbortController;

  constructor(config: GoogleTransportConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://generativelanguage.googleapis.com',
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Send messages to Google Gemini API
   */
  async send(
    messages: Message[],
    options: {
      tools?: unknown[];
      systemInstruction?: string;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<unknown> {
    // Prepare Google format
    const { systemInstruction, googleMessages } = this.prepareGoogleFormat(messages);

    // Build request body
    const requestBody: Record<string, unknown> = {
      contents: googleMessages,
    };

    // Add system instruction
    if (options.systemInstruction || systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: options.systemInstruction || systemInstruction }],
      };
    }

    // Add tools (function declarations)
    if (options.tools && options.tools.length > 0) {
      requestBody.tools = [
        {
          functionDeclarations: options.tools,
        },
      ];
    }

    // Add generation config
    const generationConfig: Record<string, unknown> = {};
    if (options.temperature !== undefined) {
      generationConfig.temperature = options.temperature;
    }
    if (options.maxTokens) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }
    if (Object.keys(generationConfig).length > 0) {
      requestBody.generationConfig = generationConfig;
    }

    // Handle streaming vs non-streaming
    if (options.stream) {
      return await this.sendStreaming(requestBody);
    } else {
      return await this.sendNonStreaming(requestBody);
    }
  }

  /**
   * Send non-streaming request using direct HTTP
   */
  private async sendNonStreaming(requestBody: Record<string, unknown>): Promise<unknown> {
    const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    try {
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => this.abortController?.abort(), this.config.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
      throw new Error(
        `Google API transport error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send streaming request using direct HTTP with Server-Sent Events
   */
  private async sendStreaming(requestBody: Record<string, unknown>): Promise<unknown> {
    const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;

    try {
      this.abortController = new AbortController();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
        `Google API streaming transport error: ${error instanceof Error ? error.message : String(error)}`
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
   * Prepare messages for Google's format
   * This is transport-specific format conversion, not composition
   */
  private prepareGoogleFormat(messages: Message[]): {
    systemInstruction?: string;
    googleMessages: unknown[];
  } {
    let systemInstruction: string | undefined;
    const googleMessages: unknown[] = [];

    for (const message of messages) {
      // Extract system instruction from system messages
      if (message.role === MESSAGE_ROLES.SYSTEM) {
        if (typeof message.content === 'string') {
          systemInstruction = message.content;
        }
        continue;
      }

      // Map role to Google format
      const role = message.role === MESSAGE_ROLES.ASSISTANT ? 'model' : MESSAGE_ROLES.USER;

      // Handle different message shapes
      if (message.parts) {
        // Already in Google parts format
        googleMessages.push({
          role,
          parts: message.parts,
        });
      } else if (Array.isArray(message.content)) {
        // Anthropic content blocks - convert to Google parts
        const parts: unknown[] = [];

        for (const block of message.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'tool_use') {
            // Convert Anthropic tool use to Google function call
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input || {},
              },
            });
          } else if (block.type === 'tool_result') {
            // Convert tool result to Google function response
            parts.push({
              functionResponse: {
                name: 'unknown', // Google needs the function name
                response: {
                  result: block.content,
                },
              },
            });
          }
        }

        if (parts.length > 0) {
          googleMessages.push({ role, parts });
        }
      } else if (message.tool_calls) {
        // OpenAI tool calls - convert to Google function calls
        const parts: unknown[] = [];

        // Add any text content first
        if (message.content) {
          parts.push({ text: message.content });
        }

        // Add function calls
        for (const toolCall of message.tool_calls) {
          parts.push({
            functionCall: {
              name: toolCall.function?.name || toolCall.name,
              args: toolCall.function?.arguments
                ? (JSON.parse(toolCall.function.arguments) as unknown)
                : toolCall.args || {},
            },
          });
        }

        googleMessages.push({ role: 'model', parts });
      } else if (message.tool_call_id) {
        // Tool response - convert to Google function response
        googleMessages.push({
          role: MESSAGE_ROLES.USER,
          parts: [
            {
              functionResponse: {
                name: message.name || 'unknown',
                response: {
                  result: message.content || '',
                },
              },
            },
          ],
        });
      } else if (typeof message.content === 'string') {
        // String content - wrap in text part
        googleMessages.push({
          role,
          parts: [{ text: message.content }],
        });
      } else {
        // Fallback to empty text part
        googleMessages.push({
          role,
          parts: [{ text: '' }],
        });
      }
    }

    return { systemInstruction, googleMessages };
  }

  /**
   * Test connection to Google API
   */
  async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: MESSAGE_ROLES.USER,
              parts: [{ text: 'Hello' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
          },
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
  async getModelInfo(): Promise<unknown> {
    try {
      const url = `${this.config.baseUrl}/v1beta/models/${this.config.model}?key=${this.config.apiKey}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const modelInfo = (await response.json()) as Record<string, unknown>;

      return {
        ...modelInfo,
        provider: 'google',
        supportsStreaming: true,
        supportsTools: true,
      };
    } catch (_error) {
      // Fallback if model info not available
      return {
        model: this.config.model,
        provider: 'google',
        supportsStreaming: true,
        supportsTools: true,
        baseUrl: this.config.baseUrl,
      };
    }
  }

  /**
   * Convert Google response to standardized format
   */
  parseResponse(response: unknown): {
    content?: string;
    functionCalls?: unknown[];
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    finishReason?: string;
    safetyRatings?: unknown[];
  } {
    const result: Record<string, unknown> = {};

    if (response && typeof response === 'object' && 'data' in response) {
      const data = (response as { data: unknown }).data;
      const candidate =
        data && typeof data === 'object' && 'candidates' in data
          ? (data as { candidates: unknown[] }).candidates?.[0]
          : undefined;

      if (candidate) {
        // Extract content and function calls from parts
        if (candidate && typeof candidate === 'object' && 'content' in candidate) {
          const content = (candidate as { content: unknown }).content;
          if (content && typeof content === 'object' && 'parts' in content) {
            const parts = (content as { parts: unknown[] }).parts;
            if (Array.isArray(parts)) {
              const textParts: string[] = [];
              const functionCalls: unknown[] = [];

              // Process all parts to extract both text and function calls
              for (const part of parts) {
                if (part && typeof part === 'object') {
                  // Extract text parts
                  if ('text' in part && typeof (part as { text: unknown }).text === 'string') {
                    textParts.push((part as { text: string }).text);
                  }
                  // Extract function calls
                  if ('functionCall' in part) {
                    functionCalls.push((part as { functionCall: unknown }).functionCall);
                  }
                }
              }

              // Set content if we have text parts
              if (textParts.length > 0) {
                result.content = textParts.join('');
              }

              // Set function calls if we have any
              if (functionCalls.length > 0) {
                result.functionCalls = functionCalls;
              }
            }
          }
        }

        // Extract finish reason
        if (candidate && typeof candidate === 'object' && 'finishReason' in candidate) {
          result.finishReason = (candidate as { finishReason: unknown }).finishReason;
        }

        // Extract safety ratings
        if (candidate && typeof candidate === 'object' && 'safetyRatings' in candidate) {
          result.safetyRatings = (candidate as { safetyRatings: unknown }).safetyRatings;
        }
      }

      // Extract usage metadata
      if (data && typeof data === 'object' && 'usageMetadata' in data) {
        const usageMetadata = (data as { usageMetadata: unknown }).usageMetadata;
        if (usageMetadata && typeof usageMetadata === 'object') {
          const metadata = usageMetadata as Record<string, unknown>;
          result.usage = {
            inputTokens:
              typeof metadata.promptTokenCount === 'number' ? metadata.promptTokenCount : 0,
            outputTokens:
              typeof metadata.candidatesTokenCount === 'number' ? metadata.candidatesTokenCount : 0,
            totalTokens:
              typeof metadata.totalTokenCount === 'number' ? metadata.totalTokenCount : 0,
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
    onChunk?: (chunk: { text?: string; functionCalls?: unknown[] }) => void
  ): Promise<{
    fullText: string;
    functionCalls: unknown[];
    usage?: unknown;
  }> {
    let fullText = '';
    const functionCallsAccumulator: unknown[] = [];
    let finalUsage;

    // Type guard for streaming result
    if (!streamingResult || typeof streamingResult !== 'object' || !('stream' in streamingResult)) {
      throw new Error('Expected streaming result with stream property');
    }

    const streamResult = streamingResult as { stream: AsyncIterable<unknown> };
    for await (const rawChunk of streamResult.stream) {
      // Type guard for chunk structure
      const chunk = rawChunk;
      if (!chunk || typeof chunk !== 'object') continue;

      const chunkObj = chunk as {
        candidates?: unknown;
        usageMetadata?: unknown;
      };

      // Safe access to candidates array
      if (
        chunkObj.candidates &&
        Array.isArray(chunkObj.candidates) &&
        chunkObj.candidates.length > 0
      ) {
        const candidate = chunkObj.candidates[0] as unknown;
        if (candidate && typeof candidate === 'object') {
          const candidateObj = candidate as {
            content?: unknown;
          };

          // Safe access to content and parts
          if (candidateObj.content && typeof candidateObj.content === 'object') {
            const content = candidateObj.content as {
              parts?: unknown;
            };

            if (content.parts && Array.isArray(content.parts)) {
              for (const part of content.parts) {
                if (part && typeof part === 'object') {
                  const partObj = part as {
                    text?: unknown;
                    functionCall?: unknown;
                  };

                  // Safe text extraction
                  if (partObj.text && typeof partObj.text === 'string') {
                    fullText += partObj.text;

                    if (onChunk) {
                      onChunk({ text: partObj.text });
                    }
                  }

                  // Safe function call extraction
                  if (partObj.functionCall) {
                    functionCallsAccumulator.push(partObj.functionCall);
                  }
                }
              }
            }
          }
        }
      }

      // Safe usage metadata extraction
      if (chunkObj.usageMetadata && typeof chunkObj.usageMetadata === 'object') {
        const usageMetadata = chunkObj.usageMetadata as {
          promptTokenCount?: unknown;
          candidatesTokenCount?: unknown;
          totalTokenCount?: unknown;
        };
        finalUsage = {
          inputTokens:
            typeof usageMetadata.promptTokenCount === 'number' ? usageMetadata.promptTokenCount : 0,
          outputTokens:
            typeof usageMetadata.candidatesTokenCount === 'number'
              ? usageMetadata.candidatesTokenCount
              : 0,
          totalTokens:
            typeof usageMetadata.totalTokenCount === 'number' ? usageMetadata.totalTokenCount : 0,
        };
      }
    }

    if (functionCallsAccumulator.length > 0 && onChunk) {
      onChunk({ functionCalls: functionCallsAccumulator });
    }

    return {
      fullText,
      functionCalls: functionCallsAccumulator,
      usage: finalUsage,
    };
  }

  /**
   * Update transport configuration
   */
  updateConfig(updates: Partial<GoogleTransportConfig>): void {
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
