/**
 * OpenAI-Compatible Provider Base Class
 *
 * Base class for all providers that use OpenAI-compatible APIs
 * (OpenAI, Groq, Ollama, LMStudio, etc.)
 *
 * This class handles all common functionality including:
 * - Message composition and transport
 * - Tool registry transformation
 * - Streaming and non-streaming responses
 * - Tool execution and synchronization
 * - WebSocket communication
 * - Usage tracking
 */

import { AgentConfig, Message, ToolRegistry, ToolCall } from '../types/index.js';
import { BaseServiceProvider } from './base-provider.js';
import { MessageShapeComposer } from '../composition/message-shape-composer.js';
import { OpenAIAPITransport } from '../transport/openai-api-transport.js';
import { MESSAGE_ROLES } from '../constants/message-constants.js';

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxTokens?: number;
  debugMode?: boolean;
}

export abstract class OpenAICompatibleProvider extends BaseServiceProvider {
  protected transport: OpenAIAPITransport;
  protected shapeComposer: MessageShapeComposer;
  protected debugMode: boolean;

  constructor(
    agentConfig: AgentConfig,
    serviceProvider: string,
    config: OpenAICompatibleConfig,
    toolRegistry?: ToolRegistry
  ) {
    super(agentConfig, serviceProvider, toolRegistry);

    // Initialize transport layer with provider-specific configuration
    this.transport = new OpenAIAPITransport({
      apiKey: config.apiKey,
      model: agentConfig.model_name,
      baseUrl: config.baseUrl,
      timeout: config.timeout || 30000,
    });

    // Initialize shape composer
    this.shapeComposer = new MessageShapeComposer();

    // Set debug mode
    this.debugMode = config.debugMode || false;
  }

  async makeApiCall(
    messages: Message[],
    userInput: string,
    websocket?: { send(data: string): void },
    streamResponse = false
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    if (this.debugMode) {
      console.log(`🔍 [${this.service_provider}] makeApiCall started`);
      console.log('  - Initial messages count:', messages.length);
      console.log('  - User input:', userInput?.substring(0, 100));
      console.log('  - Stream mode:', streamResponse);
    }

    try {
      // Add user input to messages if provided
      const allMessages = userInput
        ? [...messages, { role: MESSAGE_ROLES.USER, content: userInput }]
        : messages;

      // Ensure system prompt is included
      const messagesWithSystem = this.ensureSystemPrompt(allMessages);

      if (this.debugMode) {
        console.log('  - Messages after system prompt:', messagesWithSystem.length);
        console.log('  - System prompt:', this.system_prompt?.substring(0, 100));
      }

      // Compose messages using shape composer
      const composedMessages = messagesWithSystem.map((msg) => {
        if (this.debugMode) {
          console.log(`    - Message role: ${msg.role}, content type: ${typeof msg.content}`);
        }
        return this.shapeComposer.compose(msg);
      });

      // Get transformed tools
      const tools = this.transformToolRegistry();

      if (this.debugMode) {
        console.log('  - Tools count:', tools?.length || 0);
        console.log(`📤 [${this.service_provider}] Sending to transport layer...`);
      }

      // Use transport layer for API call
      const transportResult = await this.transport.send(composedMessages, {
        tools,
        systemPrompt: this.system_prompt,
        stream: streamResponse,
        temperature: 0.7,
        maxTokens: this.getMaxTokens(),
      });

      if (streamResponse && websocket) {
        return await this.handleStreamingResponseWithToolExecution(
          transportResult,
          allMessages,
          websocket
        );
      } else {
        return await this.handleNonStreamingResponseWithToolExecution(
          transportResult,
          allMessages,
          websocket
        );
      }
    } catch (error: unknown) {
      console.error(`${this.service_provider} API error:`, error);
      if (this.debugMode && error instanceof Error) {
        console.error('  - Error type:', error.constructor.name);
        console.error('  - Error message:', error.message);
        if (error.stack) {
          console.error('  - Stack trace:', error.stack);
        }
      }
      throw new Error(
        `${this.service_provider} API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle streaming response from transport layer
   */
  private async handleStreamingResponseWithToolExecution(
    transportResult: unknown,
    allMessages: Message[],
    websocket?: { send(data: string): void }
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    if (
      !transportResult ||
      typeof transportResult !== 'object' ||
      (transportResult as Record<string, unknown>).type !== 'streaming'
    ) {
      throw new Error('Expected streaming transport result');
    }

    const streamingResult = await this.transport.processStreamingResponse(
      transportResult,
      (chunk) => {
        if (chunk.text && websocket) {
          void this.sendWebSocketMessages(websocket, chunk.text, undefined, false);
        }
      }
    );

    // Track usage with type checking
    if (
      streamingResult &&
      typeof streamingResult === 'object' &&
      streamingResult.usage &&
      typeof streamingResult.usage === 'object'
    ) {
      const usage = streamingResult.usage as {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
      this.usage_info = {
        input_tokens: usage.inputTokens || 0,
        output_tokens: usage.outputTokens || 0,
        total_tokens: usage.totalTokens || 0,
      };
    }

    // Handle tool calls
    if (
      streamingResult &&
      typeof streamingResult === 'object' &&
      streamingResult.toolCalls &&
      Array.isArray(streamingResult.toolCalls) &&
      streamingResult.toolCalls.length > 0
    ) {
      console.log('Tool calls detected in stream, executing server-side...');

      // Add assistant's response with tool calls to conversation
      const streamingRes = streamingResult as { fullText?: string; toolCalls: unknown[] };
      const assistantMessage: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: streamingRes.fullText || '',
        tool_calls: streamingRes.toolCalls as ToolCall[],
      };

      allMessages.push(assistantMessage);

      // Handle multiple tool calls if present
      const response = await this.handleMultipleToolCalls(
        streamingRes.fullText || null,
        streamingRes.toolCalls,
        allMessages,
        websocket,
        true
      );
      return { response, completeMessages: allMessages };
    } else {
      // No function calls, send final response
      const streamingRes = streamingResult as { fullText?: string };
      if (websocket) {
        void this.sendWebSocketMessages(websocket, streamingRes.fullText || '', undefined, true);
      }

      const response: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: streamingRes.fullText || '',
      };

      // Add final response to conversation
      allMessages.push(response);

      return { response, completeMessages: allMessages };
    }
  }

  /**
   * Handle non-streaming response from transport layer
   */
  private async handleNonStreamingResponseWithToolExecution(
    transportResult: unknown,
    allMessages: Message[],
    websocket?: { send(data: string): void }
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    if (
      !transportResult ||
      typeof transportResult !== 'object' ||
      (transportResult as Record<string, unknown>).type !== 'non_streaming'
    ) {
      throw new Error('Expected non-streaming transport result');
    }

    const parsedResponse = this.transport.parseResponse(transportResult);

    // Track usage with type checking
    if (
      parsedResponse &&
      typeof parsedResponse === 'object' &&
      parsedResponse.usage &&
      typeof parsedResponse.usage === 'object'
    ) {
      const usage = parsedResponse.usage as {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
      this.usage_info = {
        input_tokens: usage.inputTokens || 0,
        output_tokens: usage.outputTokens || 0,
        total_tokens: usage.totalTokens || 0,
      };
    }

    // Handle tool calls
    if (
      parsedResponse &&
      typeof parsedResponse === 'object' &&
      parsedResponse.toolCalls &&
      Array.isArray(parsedResponse.toolCalls) &&
      parsedResponse.toolCalls.length > 0
    ) {
      console.log('Tool calls detected, executing server-side...');

      // Add assistant's response with tool calls to conversation
      const parsedRes = parsedResponse as { content?: string; toolCalls: unknown[] };
      const assistantMessage: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: parsedRes.content || '',
        tool_calls: parsedRes.toolCalls as ToolCall[],
      };

      allMessages.push(assistantMessage);

      // Handle multiple tool calls if present
      const response = await this.handleMultipleToolCalls(
        parsedRes.content || null,
        parsedRes.toolCalls,
        allMessages,
        websocket,
        false
      );
      return { response, completeMessages: allMessages };
    } else {
      // No function calls, send normal response
      const parsedRes = parsedResponse as { content?: string };
      if (websocket) {
        void this.sendWebSocketMessages(websocket, parsedRes.content || '', undefined, true);
      }

      const response: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: parsedRes.content || '',
      };

      // Add final response to conversation
      allMessages.push(response);

      return { response, completeMessages: allMessages };
    }
  }

  transformToolRegistry(): unknown[] {
    return this.transformToolsBase((name, tool) => {
      try {
        // Validate tool structure with proper type checking
        if (!tool || typeof tool !== 'object') {
          console.warn(`Skipping tool ${name} - invalid tool structure`);
          return null;
        }

        const toolObj = tool as {
          parameters?: unknown;
          description?: unknown;
          inputSchema?: {
            type?: string;
            properties?: unknown;
            required?: unknown;
          };
        };

        // Check for either inputSchema or parameters
        if (!toolObj.inputSchema && !toolObj.parameters) {
          console.warn(`Skipping tool ${name} - missing inputSchema and parameters`);
          return null;
        }

        // Build OpenAI tool declaration with proper typing
        const toolDeclaration: Record<string, unknown> = {
          type: 'function',
          function: {
            name: name,
            description: typeof toolObj.description === 'string' ? toolObj.description : '',
            parameters: {
              type: 'object',
              properties: {} as Record<string, unknown>,
              required: [] as string[],
            },
          },
        };

        // Get function object with type assertion
        const func = toolDeclaration.function as {
          parameters: {
            properties: Record<string, unknown>;
            required: string[];
          };
        };

        // Handle both MCP format with inputSchema and legacy format with type checking
        let parameters: Record<string, unknown> = {};
        let requiredParams: string[] = [];

        if (toolObj.inputSchema && typeof toolObj.inputSchema === 'object') {
          // Use complete OpenAPI schema from inputSchema
          const inputSchema = toolObj.inputSchema;
          parameters = (inputSchema.properties as Record<string, unknown>) || {};
          requiredParams = Array.isArray(inputSchema.required)
            ? (inputSchema.required as string[])
            : [];
        } else if (toolObj.parameters && typeof toolObj.parameters === 'object') {
          // Fall back to legacy parameters handling
          const parametersObj = toolObj.parameters as {
            properties?: unknown;
            required?: unknown;
          };
          parameters =
            (parametersObj.properties as Record<string, unknown>) ||
            (toolObj.parameters as Record<string, unknown>);
          requiredParams = Array.isArray(parametersObj.required)
            ? (parametersObj.required as string[])
            : [];
        }

        if (parameters && typeof parameters === 'object') {
          for (const [paramName, paramInfo] of Object.entries(parameters)) {
            if (!paramInfo || typeof paramInfo !== 'object') {
              console.warn(`Skipping parameter ${paramName} in tool ${name} - invalid format`);
              continue;
            }

            const param = paramInfo as Record<string, unknown>;
            const paramDeclaration = this.transformParameterForOpenAI(paramName, param);
            func.parameters.properties[paramName] = paramDeclaration;

            // Check if parameter is required
            if (param.required === true) {
              func.parameters.required.push(paramName);
            }
          }
        }

        // Handle required parameters from OpenAPI schema or legacy format
        if (requiredParams.length > 0) {
          for (const reqParam of requiredParams) {
            if (
              typeof reqParam === 'string' &&
              func.parameters.properties[reqParam] &&
              !func.parameters.required.includes(reqParam)
            ) {
              func.parameters.required.push(reqParam);
            }
          }
        }

        return toolDeclaration;
      } catch (e) {
        console.error(`Error transforming tool ${name}:`, e);
        return null;
      }
    });
  }

  private transformParameterForOpenAI(
    paramName: string,
    paramInfo: Record<string, unknown>
  ): Record<string, unknown> {
    // OpenAI uses lowercase types with proper type checking
    let paramType = 'string'; // default

    if (paramInfo.type && typeof paramInfo.type === 'string') {
      paramType = paramInfo.type.toLowerCase();
    } else if (paramInfo.anyOf) {
      paramType = this.extractTypeFromAnyOfForOpenAI(paramInfo);
    } else {
      console.warn(`Parameter ${paramName} has no type information. Defaulting to string.`);
    }

    const paramDeclaration: Record<string, unknown> = {
      type: paramType,
      description:
        typeof paramInfo.description === 'string'
          ? paramInfo.description
          : typeof paramInfo.title === 'string'
            ? paramInfo.title
            : '',
    };

    if (paramType === 'array' && paramInfo.items && typeof paramInfo.items === 'object') {
      const items = paramInfo.items as { type?: unknown };
      const itemType = typeof items.type === 'string' ? items.type : 'string';
      paramDeclaration.items = {
        type: itemType.toLowerCase(),
      };
    }

    return paramDeclaration;
  }

  private extractTypeFromAnyOfForOpenAI(paramInfo: Record<string, unknown>): string {
    if (!paramInfo.anyOf || !Array.isArray(paramInfo.anyOf)) {
      return 'object';
    }

    for (const schema of paramInfo.anyOf) {
      if (schema && typeof schema === 'object') {
        const schemaObj = schema as { type?: unknown };
        if (schemaObj.type && typeof schemaObj.type === 'string' && schemaObj.type !== 'null') {
          return schemaObj.type.toLowerCase();
        }
      }
    }
    return 'object';
  }

  /**
   * Implementation of abstract methods for tool call handling
   */
  extractPartsFromResponse(response: unknown): {
    fullMessage: unknown;
    usageInfo: unknown;
    toolUse: unknown;
    text: string | null;
    stopReason: string;
  } {
    // Parse using transport layer with type safety
    const transportResult = {
      type: 'non_streaming' as const,
      data: response,
    };
    const parsed = this.transport.parseResponse(transportResult);

    return {
      fullMessage: response,
      usageInfo: parsed.usage,
      toolUse:
        parsed.toolCalls && Array.isArray(parsed.toolCalls) && parsed.toolCalls.length > 0
          ? parsed.toolCalls[0]
          : null,
      text: parsed.content || null,
      stopReason: parsed.finishReason || 'stop',
    };
  }

  extractToolCallInfo(toolCall: unknown): {
    id: string;
    name: string;
    arguments: string;
  } {
    if (!toolCall || typeof toolCall !== 'object') {
      return { id: '', name: '', arguments: '{}' };
    }

    const tc = toolCall as {
      id?: unknown;
      function?: { name?: unknown; arguments?: unknown };
      name?: unknown;
      args?: unknown;
    };

    const id = typeof tc.id === 'string' ? tc.id : '';
    const name = tc.function?.name
      ? typeof tc.function.name === 'string'
        ? tc.function.name
        : ''
      : typeof tc.name === 'string'
        ? tc.name
        : '';
    const args = tc.function?.arguments
      ? typeof tc.function.arguments === 'string'
        ? tc.function.arguments
        : JSON.stringify(tc.function.arguments)
      : JSON.stringify(tc.args || {});

    return { id, name, arguments: args };
  }

  formatToolResponseMessage(functionResult: string, toolName: string, toolCallId: string): Message {
    // Use OpenAI tool response format
    return {
      role: MESSAGE_ROLES.TOOL,
      tool_call_id: toolCallId,
      name: toolName,
      content: functionResult,
    };
  }

  /**
   * Handle multiple tool calls for OpenAI-compatible providers
   */
  protected async handleMultipleToolCalls(
    messageContent: string | null,
    toolCalls: unknown[],
    messages: Message[],
    websocket?: { send(data: string): void },
    doStream = false
  ): Promise<unknown> {
    try {
      // Execute all tool calls and collect responses
      const toolResponses: Message[] = [];

      for (const toolCall of toolCalls) {
        // Extract tool call information
        const {
          id: toolCallId,
          name: toolName,
          arguments: toolArgs,
        } = this.extractToolCallInfo(toolCall);
        console.log(`Executing tool: ${toolName} with args: ${toolArgs}`);

        // Send tool execution status to WebSocket
        if (websocket) {
          const statusMessage = {
            tool_call: true,
            tool_name: toolName,
            tool_status: 'executing',
          };
          websocket.send(JSON.stringify(statusMessage));
        }

        // Execute the tool
        let functionResult: string;
        try {
          functionResult = await this.invokeTool(toolName, toolArgs);
          console.log(`Tool ${toolName} result:`, functionResult);
        } catch (error) {
          functionResult = `Error: ${error instanceof Error ? error.message : 'Tool execution failed'}`;
          console.error(`Tool ${toolName} failed:`, error);
        }

        // Send tool completion status to WebSocket
        if (websocket) {
          const statusMessage = {
            tool_call: true,
            tool_name: toolName,
            tool_status: 'completed',
            tool_result: functionResult,
          };
          websocket.send(JSON.stringify(statusMessage));
        }

        // Create tool response message
        const toolResponseMessage = this.formatToolResponseMessage(
          functionResult,
          toolName,
          toolCallId
        );

        // Add to responses array
        toolResponses.push(toolResponseMessage);

        // Send tool result message to WebSocket
        if (websocket) {
          websocket.send(
            JSON.stringify({
              role: MESSAGE_ROLES.TOOL,
              name: toolName,
              content: functionResult,
              tool_call_id: toolCallId,
            })
          );
        }
      }

      // Add all tool responses to conversation in correct order
      for (const response of toolResponses) {
        messages.push(response);
        if (this.debugMode) {
          console.log('Added tool response to conversation:', JSON.stringify(response, null, 2));
        }
      }

      // Make recursive API call with updated messages including all tool responses
      if (this.debugMode) {
        console.log('Making recursive API call after all tool executions...');
        console.log('Messages for recursive call:', messages.length, 'streaming:', doStream);
      }

      // The recursive call should handle its own WebSocket streaming
      const result = await this.makeApiCall(messages, '', websocket, doStream);

      if (this.debugMode) {
        console.log('Recursive call completed, response type:', typeof result.response);
        if (result.response && typeof result.response === 'object') {
          const resp = result.response as { content?: string };
          console.log('Response content length:', resp.content?.length || 0);
        }
      }

      return result.response;
    } catch (error) {
      console.error(`Error handling multiple tool calls:`, error);

      if (websocket) {
        websocket.send(
          JSON.stringify({
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
        );
      }

      throw error;
    }
  }

  /**
   * Override synchronizeMessageContextToClient for OpenAI-compatible tool response handling
   */
  protected async synchronizeMessageContextToClient(
    messageContent: string | null,
    toolCall: unknown,
    messages: Message[],
    websocket?: { send(data: string): void },
    doStream = false
  ): Promise<unknown> {
    try {
      // If no tool call, just return the message content
      if (!toolCall) {
        if (messageContent && websocket) {
          void this.sendWebSocketMessages(websocket, messageContent, undefined, true);
        }
        return {
          role: MESSAGE_ROLES.ASSISTANT,
          content: messageContent || '',
        };
      }

      // For backward compatibility, handle single tool call
      // Extract tool call information using provider-specific method
      const {
        id: toolCallId,
        name: toolName,
        arguments: toolArgs,
      } = this.extractToolCallInfo(toolCall);
      console.log(`Executing tool: ${toolName} with args: ${toolArgs}`);

      // Send tool execution status to WebSocket with type guard
      if (websocket) {
        const statusMessage = {
          tool_call: true,
          tool_name: toolName,
          tool_status: 'executing',
        };
        websocket.send(JSON.stringify(statusMessage));
      }

      // Execute the tool
      const functionResult = await this.invokeTool(toolName, toolArgs);
      console.log(`Tool ${toolName} result:`, functionResult);

      // Send tool completion status to WebSocket
      if (websocket) {
        const statusMessage = {
          tool_call: true,
          tool_name: toolName,
          tool_status: 'completed',
          tool_result: functionResult,
        };
        websocket.send(JSON.stringify(statusMessage));
      }

      // Create tool response using OpenAI format
      const toolResponseMessage = this.formatToolResponseMessage(
        functionResult,
        toolName,
        toolCallId
      );

      // Add tool result to conversation
      if (this.debugMode) {
        console.log(
          'Adding tool response message to conversation:',
          JSON.stringify(toolResponseMessage, null, 2)
        );
      }
      messages.push(toolResponseMessage);

      // Send tool result message to WebSocket for complete conversation history
      if (websocket) {
        websocket.send(
          JSON.stringify({
            role: MESSAGE_ROLES.TOOL,
            name: toolName,
            content: functionResult,
            tool_call_id: toolCallId,
          })
        );
      }

      // Make recursive API call with updated messages
      if (this.debugMode) {
        console.log('Making recursive API call after tool execution...');
      }
      const result = await this.makeApiCall(messages, '', websocket, doStream);
      return result.response;
    } catch (error) {
      console.error(`Error in ${this.service_provider} synchronizeMessageContextToClient:`, error);

      if (websocket) {
        websocket.send(
          JSON.stringify({
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
        );
      }

      throw error;
    }
  }

  /**
   * Get max tokens for this provider
   * Can be overridden by specific providers
   */
  protected getMaxTokens(): number | undefined {
    // Return undefined by default (let the API use its default)
    // OpenAI and Groq will override this
    return undefined;
  }
}
