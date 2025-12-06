import { AgentConfig, Message, ToolRegistry, ContentBlock } from '../types/index.js';
import { BaseServiceProvider } from './base-provider.js';
import { MessageShapeComposer } from '../composition/message-shape-composer.js';
import { AnthropicAPITransport } from '../transport/anthropic-api-transport.js';
import { SERVICE_PROVIDERS, MESSAGE_ROLES, PART_TYPES } from '../constants/message-constants.js';
import {
  TransportResult,
  NonStreamingTransportResult,
  StreamingTransportResult,
} from '../types/transport-types.js';

interface ToolInputSchema {
  type: string;
  properties: Record<string, unknown>;
  required: string[];
}

export class AnthropicProvider extends BaseServiceProvider {
  private transport: AnthropicAPITransport;
  private shapeComposer: MessageShapeComposer;

  constructor(agentConfig: AgentConfig, toolRegistry?: ToolRegistry) {
    super(agentConfig, SERVICE_PROVIDERS.ANTHROPIC, toolRegistry);

    // Initialize transport layer
    this.transport = new AnthropicAPITransport({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: agentConfig.model_name,
      timeout: 30000,
    });

    // Initialize shape composer
    this.shapeComposer = new MessageShapeComposer();
  }

  async makeApiCall(
    messages: Message[],
    userInput: string,
    websocket?: { send(data: string): void },
    streamResponse = false
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    try {
      // Add user input to messages if provided
      const allMessages = userInput
        ? [...messages, { role: MESSAGE_ROLES.USER, content: userInput }]
        : messages;

      // Ensure system prompt is included
      const messagesWithSystem = this.ensureSystemPrompt(allMessages);

      // Compose messages using shape composer
      const composedMessages = messagesWithSystem.map((msg) => this.shapeComposer.compose(msg));

      // Get transformed tools
      const tools = this.transformToolRegistry();

      // Use transport layer for API call
      const transportResult = await this.transport.send(composedMessages, {
        tools,
        systemPrompt: this.system_prompt,
        stream: streamResponse,
        temperature: 0.7,
        maxTokens: 8192,
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
      console.error('Anthropic API error:', error);
      throw new Error(
        `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle streaming response from transport layer
   */
  private async handleStreamingResponseWithToolExecution(
    transportResult: TransportResult,
    allMessages: Message[],
    websocket?: { send(data: string): void }
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    if (transportResult.type !== 'streaming') {
      throw new Error('Expected streaming transport result');
    }

    const streamingResult = transportResult as StreamingTransportResult;

    const processedResult = await this.transport.processStreamingResponse(
      streamingResult,
      (chunk) => {
        if (chunk.text && websocket) {
          this.sendWebSocketMessages(websocket, chunk.text, undefined, false);
        }
      }
    );

    // Track usage
    if (
      processedResult &&
      typeof processedResult === 'object' &&
      processedResult.usage &&
      typeof processedResult.usage === 'object'
    ) {
      const usage = processedResult.usage as {
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

    // Handle tool use
    if (
      processedResult &&
      typeof processedResult === 'object' &&
      processedResult.toolUse &&
      Array.isArray(processedResult.toolUse) &&
      processedResult.toolUse.length > 0
    ) {
      console.log('Tool use detected in stream, executing server-side...');

      // Add assistant's response with tool use to conversation
      const assistantMessage: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: [],
      };

      if (processedResult.fullText && Array.isArray(assistantMessage.content)) {
        assistantMessage.content.push({ type: PART_TYPES.TEXT, text: processedResult.fullText });
      }

      const processedRes = processedResult as { toolUse: unknown[] };
      processedRes.toolUse.forEach((toolUse) => {
        if (Array.isArray(assistantMessage.content) && toolUse && typeof toolUse === 'object') {
          const tool = toolUse as { id?: string; name?: string; input?: unknown };
          assistantMessage.content.push({
            type: PART_TYPES.TOOL_USE,
            id: tool.id || '',
            name: tool.name || '',
            input: tool.input as Record<string, unknown>,
          });
        }
      });

      allMessages.push(assistantMessage);

      const response = await this.synchronizeMessageContextToClient(
        (processedRes as { fullText?: string }).fullText || null,
        processedRes.toolUse[0],
        allMessages,
        websocket,
        true
      );
      return { response, completeMessages: allMessages };
    } else {
      // No function calls, send final response
      const processedRes = processedResult as { fullText?: string };
      if (websocket) {
        this.sendWebSocketMessages(websocket, processedRes.fullText || '', undefined, true);
      }

      const response = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: processedRes.fullText || '',
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
    transportResult: TransportResult,
    allMessages: Message[],
    websocket?: { send(data: string): void }
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    if (transportResult.type !== 'non_streaming') {
      throw new Error('Expected non-streaming transport result');
    }

    const nonStreamingResult = transportResult as NonStreamingTransportResult;
    const parsedResponse = this.transport.parseResponse({
      type: 'non_streaming',
      data: nonStreamingResult.data,
    } as TransportResult);

    // Track usage
    if (
      parsedResponse &&
      typeof parsedResponse === 'object' &&
      parsedResponse.usage &&
      typeof parsedResponse.usage === 'object'
    ) {
      const usage = parsedResponse.usage as { input_tokens?: number; output_tokens?: number };
      this.usage_info = {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      };
    }

    // Handle tool use
    if (parsedResponse.toolUse && parsedResponse.toolUse.length > 0) {
      console.log('Tool use detected, executing server-side...');

      // Add assistant's response with tool use to conversation
      const assistantMessage: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: [],
      };

      if (parsedResponse.content && Array.isArray(assistantMessage.content)) {
        assistantMessage.content.push({ type: PART_TYPES.TEXT, text: parsedResponse.content });
      }

      parsedResponse.toolUse.forEach((toolUse) => {
        const tool = toolUse as { id: string; name: string; input: unknown };
        if (Array.isArray(assistantMessage.content)) {
          assistantMessage.content.push({
            type: PART_TYPES.TOOL_USE,
            id: tool.id,
            name: tool.name,
            input: tool.input as Record<string, unknown>,
          });
        }
      });

      allMessages.push(assistantMessage);

      const response = await this.synchronizeMessageContextToClient(
        parsedResponse.content || null,
        parsedResponse.toolUse[0],
        allMessages,
        websocket,
        false
      );
      return { response, completeMessages: allMessages };
    } else {
      // No function calls, send normal response
      if (websocket) {
        this.sendWebSocketMessages(websocket, parsedResponse.content || '', undefined, true);
      }

      const response = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: parsedResponse.content,
      };

      // Add final response to conversation
      allMessages.push(response);

      return { response, completeMessages: allMessages };
    }
  }

  transformToolRegistry(): unknown[] {
    return this.transformToolsBase((name, tool) => {
      try {
        // Validate tool structure
        const toolDef = tool as { 
          parameters?: unknown; 
          description?: string;
          inputSchema?: {
            type?: string;
            properties?: unknown;
            required?: unknown;
          };
        };
        if (!toolDef || typeof toolDef !== 'object') {
          console.warn(`Skipping tool ${name} - invalid tool structure`);
          return null;
        }

        // Build Anthropic tool declaration
        const toolDeclaration: Record<string, unknown> = {
          name: name,
          description: toolDef.description || '',
          input_schema: {
            type: 'object',
            properties: {},
            required: [],
          },
        };

        // Handle both MCP format with inputSchema and legacy format
        let parameters: Record<string, unknown> = {};
        let requiredParams: string[] = [];
        
        if (toolDef.inputSchema && typeof toolDef.inputSchema === 'object') {
          // Use complete OpenAPI schema from inputSchema
          const inputSchema = toolDef.inputSchema;
          parameters = (inputSchema.properties as Record<string, unknown>) || {};
          requiredParams = Array.isArray(inputSchema.required) ? inputSchema.required as string[] : [];
        } else if (toolDef.parameters) {
          // Fall back to legacy parameters handling
          const params = toolDef.parameters as Record<string, unknown>;
          parameters = (params.properties as Record<string, unknown>) || params;
          requiredParams = Array.isArray(params.required) ? params.required as string[] : [];
        } else {
          console.warn(`Skipping tool ${name} - no parameters or inputSchema`);
          return null;
        }

        if (parameters && typeof parameters === 'object') {
          for (const [paramName, paramInfo] of Object.entries(parameters)) {
            if (!paramInfo || typeof paramInfo !== 'object') {
              console.warn(`Skipping parameter ${paramName} in tool ${name} - invalid format`);
              continue;
            }

            const param = paramInfo as Record<string, unknown>;
            const paramDeclaration = this.transformParameterForAnthropic(paramName, param);
            const inputSchema = toolDeclaration.input_schema as ToolInputSchema;
            inputSchema.properties[paramName] = paramDeclaration;

            // Check if parameter is required
            if (param.required === true) {
              const inputSchema = toolDeclaration.input_schema as ToolInputSchema;
              inputSchema.required.push(paramName);
            }
          }
        }

        // Handle required parameters from OpenAPI schema or legacy format
        if (requiredParams.length > 0) {
          const inputSchema = toolDeclaration.input_schema as ToolInputSchema;
          for (const reqParam of requiredParams) {
            if (inputSchema.properties[reqParam] && !inputSchema.required.includes(reqParam)) {
              inputSchema.required.push(reqParam);
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

  private transformParameterForAnthropic(
    paramName: string,
    paramInfo: Record<string, unknown>
  ): Record<string, unknown> {
    // Anthropic uses lowercase types
    let paramType = 'string'; // default

    if (paramInfo.type) {
      paramType = (paramInfo.type as string).toLowerCase();
    } else if (paramInfo.anyOf) {
      paramType = this.extractTypeFromAnyOfForAnthropic(paramInfo);
    } else {
      console.warn(`Parameter ${paramName} has no type information. Defaulting to string.`);
    }

    const paramDeclaration: Record<string, unknown> = {
      type: paramType,
      description:
        (typeof paramInfo.description === 'string' ? paramInfo.description : '') ||
        (typeof paramInfo.title === 'string' ? paramInfo.title : '') ||
        '',
    };

    if (paramType === 'array' && paramInfo.items && typeof paramInfo.items === 'object') {
      const items = paramInfo.items as Record<string, unknown>;
      paramDeclaration.items = {
        type: typeof items.type === 'string' ? items.type.toLowerCase() : 'string',
      };
    }

    return paramDeclaration;
  }

  private extractTypeFromAnyOfForAnthropic(paramInfo: Record<string, unknown>): string {
    const anyOfArray = paramInfo.anyOf as Record<string, unknown>[];
    for (const schema of anyOfArray) {
      if (schema.type && schema.type !== 'null') {
        return (schema.type as string).toLowerCase();
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
    // Parse using transport layer
    const parsed = this.transport.parseResponse({ type: 'non_streaming', data: response });

    return {
      fullMessage: response,
      usageInfo: parsed.usage,
      toolUse: parsed.toolUse && parsed.toolUse.length > 0 ? parsed.toolUse[0] : null,
      text: parsed.content || null,
      stopReason: parsed.stopReason || 'stop',
    };
  }

  extractToolCallInfo(toolCall: Record<string, unknown>): {
    id: string;
    name: string;
    arguments: string;
  } {
    return {
      id: toolCall.id as string, // Anthropic uses tool_use id
      name: toolCall.name as string,
      arguments: JSON.stringify(toolCall.input),
    };
  }

  formatToolResponseMessage(functionResult: string, toolName: string, toolCallId: string): Message {
    // Use shape composer to create tool result
    // Return tool_result block for Anthropic's content array format
    return {
      role: MESSAGE_ROLES.USER,
      content: [
        {
          type: PART_TYPES.TOOL_RESULT,
          tool_use_id: toolCallId,
          content: functionResult,
        },
      ],
    };
  }

  /**
   * Override synchronizeMessageContextToClient for Anthropic-specific tool response handling
   * Anthropic requires tool results to be wrapped in content blocks array
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
        if (messageContent) {
          this.sendWebSocketMessages(websocket, messageContent, undefined, true);
        }
        return {
          role: MESSAGE_ROLES.ASSISTANT,
          content: messageContent || '',
        };
      }

      // Extract tool call information using provider-specific method
      const {
        id: toolCallId,
        name: toolName,
        arguments: toolArgs,
      } = this.extractToolCallInfo(toolCall as Record<string, unknown>);
      console.log(`Executing tool: ${toolName} with args: ${toolArgs}`);

      // Send assistant message with tool_calls to WebSocket for complete conversation history
      if (websocket) {
        this.sendWebSocketMessages(websocket, messageContent || '', [toolCall], false);
      }

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

      // Create tool response using Anthropic format (tool_result block)
      const toolResponseBlock = this.formatToolResponseMessage(
        functionResult,
        toolName,
        toolCallId
      );

      // Anthropic requires tool results to be wrapped in a user message with content blocks array
      const toolResponseMessage: Message = {
        role: MESSAGE_ROLES.USER,
        content: [toolResponseBlock as unknown as ContentBlock],
      };

      // Add tool result to conversation
      console.log(
        'Adding tool response message to conversation:',
        JSON.stringify(toolResponseMessage, null, 2)
      );
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
      console.log('Making recursive API call after tool execution...');
      const result = await this.makeApiCall(messages, '', websocket, doStream);
      return result.response;
    } catch (error) {
      console.error('Error in Anthropic synchronizeMessageContextToClient:', error);

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

  // logConversationMemory and manageConversationId are now inherited from BaseServiceProvider
}
