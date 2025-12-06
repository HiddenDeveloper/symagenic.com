import { AgentConfig, Message, ToolRegistry } from '../types/index.js';
import { BaseServiceProvider } from './base-provider.js';
import { MessageShapeComposer } from '../composition/message-shape-composer.js';
import { GoogleAPITransport } from '../transport/google-api-transport.js';
import { SERVICE_PROVIDERS, MESSAGE_ROLES } from '../constants/message-constants.js';

export class GoogleProvider extends BaseServiceProvider {
  private transport: GoogleAPITransport;
  private shapeComposer: MessageShapeComposer;

  constructor(agentConfig: AgentConfig, toolRegistry?: ToolRegistry) {
    super(agentConfig, SERVICE_PROVIDERS.GOOGLE, toolRegistry);

    // Initialize transport layer
    this.transport = new GoogleAPITransport({
      apiKey: process.env.GOOGLE_API_KEY || '',
      model: agentConfig.model_name,
      timeout: 30000,
    });

    // Initialize shape composer
    this.shapeComposer = new MessageShapeComposer();
  }

  async makeApiCall(
    messages: Message[],
    userInput: string,
    websocket?: unknown,
    streamResponse = false
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    console.log('GoogleProvider.makeApiCall called with:', { userInput, streamResponse });
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
      console.log(`Google Provider: Sending ${tools.length} tools to API`);
      console.log(
        'Google Provider: Tool names:',
        tools.map((t) => (t as { name: string })?.name)
      );

      // DEBUG: Log the create_strava_activity tool schema to diagnose Google API error
      const createStravaActivityTool = tools.find((t) => (t as { name: string })?.name === 'create_strava_activity');
      if (createStravaActivityTool) {
        console.log('🔍 DEBUG create_strava_activity tool schema:', JSON.stringify(createStravaActivityTool, null, 2));
      }

      // Use transport layer for API call
      const transportResult = await this.transport.send(composedMessages, {
        tools,
        systemInstruction: this.system_prompt,
        stream: streamResponse,
        temperature: 0.7,
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
      console.error('Google AI API error:', error);
      throw new Error(
        `Google AI API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle streaming response from transport layer
   */
  private async handleStreamingResponseWithToolExecution(
    transportResult: unknown,
    allMessages: Message[],
    websocket?: unknown
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    // Type guard for transport result
    if (!transportResult || typeof transportResult !== 'object' || !('type' in transportResult)) {
      throw new Error('Invalid transport result');
    }

    const typedResult = transportResult as { type: string; stream?: AsyncIterable<unknown> };
    if (typedResult.type !== 'streaming') {
      throw new Error('Expected streaming transport result');
    }

    const streamingResult = await this.transport.processStreamingResponse(typedResult, (chunk) => {
      if (chunk.text && websocket) {
        void this.sendWebSocketMessages(websocket, chunk.text, undefined, false);
      }
    });

    // Track usage with type checking
    if (streamingResult.usage && typeof streamingResult.usage === 'object') {
      const usage = streamingResult.usage as {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
      this.usage_info = {
        input_tokens: typeof usage.inputTokens === 'number' ? usage.inputTokens : 0,
        output_tokens: typeof usage.outputTokens === 'number' ? usage.outputTokens : 0,
        total_tokens: typeof usage.totalTokens === 'number' ? usage.totalTokens : 0,
      };
    }

    // Handle function calls
    if (streamingResult.functionCalls && streamingResult.functionCalls.length > 0) {
      console.log('Function calls detected in stream, executing server-side...');

      // Add assistant's response with function call to conversation
      const assistantMessage: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        parts: [],
      };

      if (streamingResult.fullText && assistantMessage.parts) {
        assistantMessage.parts.push({ text: streamingResult.fullText });
      }

      if (assistantMessage.parts) {
        streamingResult.functionCalls.forEach((fc: unknown) => {
          assistantMessage.parts!.push({ functionCall: fc });
        });
      }

      allMessages.push(assistantMessage);

      const response = await this.synchronizeMessageContextToClient(
        streamingResult.fullText,
        streamingResult.functionCalls[0],
        allMessages,
        websocket,
        true
      );
      return { response, completeMessages: allMessages };
    } else {
      // No function calls, send final response
      if (websocket) {
        void this.sendWebSocketMessages(websocket, streamingResult.fullText, undefined, true);
      }

      const response: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: streamingResult.fullText,
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
    websocket?: unknown
  ): Promise<{ response: unknown; completeMessages: Message[] }> {
    // Type guard for transport result
    if (!transportResult || typeof transportResult !== 'object' || !('type' in transportResult)) {
      throw new Error('Invalid transport result');
    }

    const typedResult = transportResult as { type: string; data?: unknown };
    if (typedResult.type !== 'non_streaming') {
      throw new Error('Expected non-streaming transport result');
    }

    const parsedResponse = this.transport.parseResponse(typedResult);

    // Track usage with type checking
    if (parsedResponse.usage && typeof parsedResponse.usage === 'object') {
      const usage = parsedResponse.usage as {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
      this.usage_info = {
        input_tokens: typeof usage.inputTokens === 'number' ? usage.inputTokens : 0,
        output_tokens: typeof usage.outputTokens === 'number' ? usage.outputTokens : 0,
        total_tokens: typeof usage.totalTokens === 'number' ? usage.totalTokens : 0,
      };
    }

    // Handle function calls
    if (parsedResponse.functionCalls && parsedResponse.functionCalls.length > 0) {
      console.log('Function calls detected, executing server-side...');

      // Add assistant's response with function call to conversation
      const assistantMessage: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        parts: [],
      };

      if (parsedResponse.content && assistantMessage.parts) {
        assistantMessage.parts.push({ text: parsedResponse.content });
      }

      if (assistantMessage.parts) {
        parsedResponse.functionCalls.forEach((fc: unknown) => {
          assistantMessage.parts!.push({ functionCall: fc });
        });
      }

      allMessages.push(assistantMessage);

      const response = await this.synchronizeMessageContextToClient(
        parsedResponse.content || null,
        parsedResponse.functionCalls[0],
        allMessages,
        websocket,
        false
      );
      return { response, completeMessages: allMessages };
    } else {
      // No function calls, send normal response
      if (websocket) {
        void this.sendWebSocketMessages(websocket, parsedResponse.content || '', undefined, true);
      }

      const response: Message = {
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
        // Validate tool structure with proper type checking
        if (!tool || typeof tool !== 'object') {
          console.warn(`Skipping tool ${name} - invalid tool structure`);
          return null;
        }

        const toolObj = tool as {
          parameters?: unknown;
          description?: unknown;
        };

        if (!toolObj.parameters || typeof toolObj.parameters !== 'object') {
          console.warn(`Skipping tool ${name} - missing or invalid parameters`);
          return null;
        }

        // Build Google function declaration with proper typing
        const functionDeclaration: Record<string, unknown> = {
          name: name,
          description: typeof toolObj.description === 'string' ? toolObj.description : '',
          parameters: {
            type: 'OBJECT',
            properties: {} as Record<string, unknown>,
            required: [] as string[],
          },
        };

        // Handle both MCP format with inputSchema and legacy format with type checking
        const toolDefWithSchema = toolObj as {
          parameters?: unknown;
          inputSchema?: {
            type?: string;
            properties?: unknown;
            required?: unknown;
          };
        };
        
        // DEBUG: Log the tool structure for memory tools
        if (name.includes('text_search') || name.includes('execute_cypher')) {
          console.log(`🔍 DEBUG ${name} tool structure:`, JSON.stringify(toolDefWithSchema, null, 2));
        }
        
        // Prioritize inputSchema over legacy parameters field
        let parameters: Record<string, unknown> = {};
        let requiredParams: string[] = [];
        
        if (toolDefWithSchema.inputSchema && typeof toolDefWithSchema.inputSchema === 'object') {
          // Use complete OpenAPI schema from inputSchema
          const inputSchema = toolDefWithSchema.inputSchema;
          parameters = (inputSchema.properties as Record<string, unknown>) || {};
          requiredParams = Array.isArray(inputSchema.required) ? inputSchema.required as string[] : [];
          if (name.includes('text_search')) {
            console.log(`🔍 DEBUG using inputSchema:`, { parameters, requiredParams });
          }
        } else if (toolDefWithSchema.parameters && typeof toolDefWithSchema.parameters === 'object') {
          // Check if parameters are in OpenAPI format
          const paramObj = toolDefWithSchema.parameters as Record<string, unknown>;

          // Check if this is a standard OpenAPI schema with `properties` field
          if (paramObj.properties && typeof paramObj.properties === 'object') {
            // Standard OpenAPI format: { type: 'object', properties: {...}, required: [...] }
            parameters = paramObj.properties as Record<string, unknown>;
            requiredParams = Array.isArray(paramObj.required) ? paramObj.required as string[] : [];
            if (name.includes('text_search') || name.includes('create_strava_activity')) {
              console.log(`🔍 DEBUG using OpenAPI schema with properties:`, { parameters, requiredParams });
            }
          } else if (Object.values(paramObj).some(val => val && typeof val === 'object' && 'type' in val)) {
            // Direct parameter definitions (MCP format) - each key is a parameter
            parameters = paramObj;
            requiredParams = []; // MCP tools don't seem to use top-level required arrays
            if (name.includes('text_search')) {
              console.log(`🔍 DEBUG using MCP format parameters:`, { parameters, requiredParams });
            }
          } else {
            // Fallback: try to extract properties if they exist
            const parametersObj = paramObj as {
              properties?: unknown;
              required?: unknown;
            };
            parameters = (parametersObj.properties as Record<string, unknown>) || paramObj || {};
            requiredParams = Array.isArray(parametersObj.required) ? parametersObj.required as string[] : [];
            if (name.includes('text_search')) {
              console.log(`🔍 DEBUG using fallback parameters:`, { parameters, requiredParams });
            }
          }
        } else {
          if (name.includes('text_search')) {
            console.log(`🔍 DEBUG no valid parameters found`);
          }
          parameters = {};
          requiredParams = [];
        }

        if (parameters && typeof parameters === 'object') {
          for (const [paramName, paramInfo] of Object.entries(parameters)) {
            if (!paramInfo || typeof paramInfo !== 'object') {
              console.warn(`Skipping parameter ${paramName} in tool ${name} - invalid format`);
              continue;
            }

            const param = paramInfo as Record<string, unknown>;
            const paramDeclaration = this.transformParameter(paramName, param);
            const funcParams = functionDeclaration.parameters as {
              properties: Record<string, unknown>;
              required: string[];
            };
            funcParams.properties[paramName] = paramDeclaration;

            // Check if parameter is required
            if (param.required === true) {
              funcParams.required.push(paramName);
            }
          }
        }

        // Handle required parameters from OpenAPI schema or legacy format
        if (requiredParams.length > 0) {
          const funcParams = functionDeclaration.parameters as {
            properties: Record<string, unknown>;
            required: string[];
          };
          for (const reqParam of requiredParams) {
            if (
              typeof reqParam === 'string' &&
              funcParams.properties[reqParam] &&
              !funcParams.required.includes(reqParam)
            ) {
              funcParams.required.push(reqParam);
            }
          }
        }

        // Ensure non-empty properties for OBJECT type (Google requirement)
        const funcParams = functionDeclaration.parameters as {
          properties: Record<string, unknown>;
        };
        if (Object.keys(funcParams.properties).length === 0) {
          funcParams.properties.dummy = {
            type: 'STRING',
            description: 'Dummy property to ensure non-empty properties for OBJECT type',
          };
        }

        return functionDeclaration;
      } catch (e) {
        console.error(`Error transforming tool ${name}:`, e);
        return null;
      }
    });
  }

  private transformParameter(
    paramName: string,
    paramInfo: Record<string, unknown>
  ): Record<string, unknown> {
    // Convert type to uppercase with proper type checking
    let paramType = 'STRING'; // default

    if (paramInfo.type && typeof paramInfo.type === 'string') {
      paramType = paramInfo.type.toUpperCase();
    } else if (paramInfo.anyOf) {
      paramType = this.extractTypeFromAnyOf(paramInfo);
    } else {
      console.warn(`Parameter ${paramName} has no type information. Defaulting to STRING.`);
    }

    const paramDeclaration: Record<string, unknown> = {
      type: paramType,
      description: paramInfo.description || paramInfo.title || '',
    };

    if (paramType === 'ARRAY') {
      paramDeclaration.items = this.extractArrayItems(paramName, paramInfo);
    }

    return paramDeclaration;
  }

  private extractTypeFromAnyOf(paramInfo: Record<string, unknown>): string {
    if (!paramInfo.anyOf || !Array.isArray(paramInfo.anyOf)) {
      return 'OBJECT';
    }

    for (const schema of paramInfo.anyOf) {
      if (schema && typeof schema === 'object') {
        const schemaObj = schema as { type?: unknown };
        if (schemaObj.type && typeof schemaObj.type === 'string' && schemaObj.type !== 'null') {
          return schemaObj.type.toUpperCase();
        }
      }
    }
    return 'OBJECT';
  }

  private extractArrayItems(
    paramName: string,
    paramInfo: Record<string, unknown>
  ): Record<string, unknown> {
    if (paramInfo.items && typeof paramInfo.items === 'object') {
      const items = paramInfo.items as { type?: unknown };
      const itemType = typeof items.type === 'string' ? items.type : 'string';
      return {
        type: itemType.toUpperCase(),
      };
    }
    return { type: 'STRING' };
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
    const parsed = this.transport.parseResponse({ data: response });

    return {
      fullMessage: response,
      usageInfo: parsed.usage,
      toolUse:
        parsed.functionCalls && parsed.functionCalls.length > 0 ? parsed.functionCalls[0] : null,
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

    const tc = toolCall as { name?: unknown; args?: unknown };
    const name = typeof tc.name === 'string' ? tc.name : '';
    const args = tc.args || {};

    return {
      id: name, // Google uses function name as ID
      name: name,
      arguments: JSON.stringify(args),
    };
  }

  formatToolResponseMessage(functionResult: string, toolName: string): Message {
    // Google expects functionResponse wrapped in a user message with parts array
    return {
      role: MESSAGE_ROLES.USER,
      parts: [
        {
          functionResponse: {
            name: toolName,
            response: {
              content: functionResult,
            },
          },
        },
      ],
    };
  }

  /**
   * Override synchronizeMessageContextToClient for Google-specific tool response handling
   * Google requires function responses to be wrapped in a single user message with parts array
   */
  protected async synchronizeMessageContextToClient(
    messageContent: string | null,
    toolCall: unknown,
    messages: Message[],
    websocket?: unknown,
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
        id: _toolCallId,
        name: sanitizedToolName,
        arguments: toolArgs,
      } = this.extractToolCallInfo(toolCall);

      // Reverse sanitized name back to original tool name
      const toolName = this.getOriginalToolName(sanitizedToolName);

      console.log(`Executing tool: ${toolName} (sanitized: ${sanitizedToolName}) with args: ${toolArgs}`);

      // Send assistant message with tool_calls to WebSocket for complete conversation history
      if (websocket) {
        void this.sendWebSocketMessages(websocket, messageContent || '', [toolCall], false);
      }

      // Send tool execution status to WebSocket with type guard
      if (websocket && typeof websocket === 'object' && 'send' in websocket) {
        const ws = websocket as { send: (data: string) => void };
        const statusMessage = {
          tool_call: true,
          tool_name: toolName,
          tool_status: 'executing',
        };
        ws.send(JSON.stringify(statusMessage));
      }

      // Execute the tool with original name
      const functionResult = await this.invokeTool(toolName, toolArgs);
      console.log(`Tool ${toolName} result:`, functionResult);

      // Send tool completion status to WebSocket with type guard
      if (websocket && typeof websocket === 'object' && 'send' in websocket) {
        const ws = websocket as { send: (data: string) => void };
        const statusMessage = {
          tool_call: true,
          tool_name: toolName,
          tool_status: 'completed',
          tool_result: functionResult,
        };
        ws.send(JSON.stringify(statusMessage));
      }

      // Create tool response using Google format (complete message structure)
      const toolResponseMessage = this.formatToolResponseMessage(functionResult, toolName);

      // Add tool result to conversation
      messages.push(toolResponseMessage);

      // Send tool result message to WebSocket for complete conversation history
      // Use the same format as sent to Google API to maintain consistency
      if (websocket && typeof websocket === 'object' && 'send' in websocket) {
        const ws = websocket as { send: (data: string) => void };
        ws.send(JSON.stringify(toolResponseMessage));
      }

      // Make recursive API call with updated messages
      const result = await this.makeApiCall(messages, '', websocket, doStream);
      return result.response;
    } catch (error) {
      console.error('Error in Google synchronizeMessageContextToClient:', error);

      if (websocket && typeof websocket === 'object' && 'send' in websocket) {
        const ws = websocket as { send: (data: string) => void };
        ws.send(
          JSON.stringify({
            error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
        );
      }

      throw error;
    }
  }

  /**
   * Override sendWebSocketMessages to format messages in Gemini-compatible format
   * This ensures the client receives Gemini format instead of OpenAI format
   */
  protected sendWebSocketMessages(
    websocket: unknown,
    content: string,
    toolCalls?: unknown[],
    isFinal = true
  ): void {
    if (!websocket) return;

    // Type guard for WebSocket
    if (!websocket || typeof websocket !== 'object' || !('send' in websocket)) {
      return;
    }
    const ws = websocket as { send: (data: string) => void };

    if (isFinal) {
      // Send sentence format for state machine
      // Only send a sentence if there's actual content or tool calls
      const sentence = content || (toolCalls && toolCalls.length > 0 ? JSON.stringify(toolCalls) : '');

      ws.send(
        JSON.stringify({
          sentence: sentence,
          final_sentence: true,
        })
      );

      // Send Gemini format for message display
      const finalMessage: Record<string, unknown> = {
        role: MESSAGE_ROLES.MODEL, // Use "model" role for Gemini
        content: content,
        final_sentence: true,
      };

      // Convert tool_calls to Gemini parts format
      if (toolCalls && toolCalls.length > 0) {
        const parts: unknown[] = [];

        // Add text content if present
        if (content) {
          parts.push({ text: content });
        }

        // Add function calls
        toolCalls.forEach((toolCall: unknown) => {
          // Handle both OpenAI format (with function property) and Gemini format (direct name/args)
          const tc = toolCall as {
            function?: { name: string; arguments: string };
            name?: string;
            args?: unknown;
          };

          let toolName: string;
          let toolArgs: unknown;

          if (tc.function) {
            // OpenAI format
            toolName = tc.function.name;
            try {
              toolArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (error) {
              console.error('Error parsing OpenAI tool call arguments:', error);
              toolArgs = {};
            }
          } else if (tc.name) {
            // Gemini format
            toolName = tc.name;
            toolArgs = tc.args || {};
          } else {
            console.error('Unknown tool call format:', tc);
            return;
          }

          parts.push({
            functionCall: {
              name: toolName,
              args: toolArgs,
            },
          });
        });

        // Use parts array instead of content and tool_calls
        delete finalMessage.content;
        finalMessage.parts = parts;
      }

      ws.send(JSON.stringify(finalMessage));

      // Send done signal to transition state machine back to WAITING_FOR_INPUT
      ws.send(JSON.stringify({ done: true }));
    } else {
      // Streaming message
      ws.send(
        JSON.stringify({
          sentence: content,
          final_sentence: false,
        })
      );

      // If this is a tool call message, send in Gemini format
      if (toolCalls && toolCalls.length > 0) {
        const parts: unknown[] = [];

        // Add text content if present
        if (content) {
          parts.push({ text: content });
        }

        // Add function calls
        toolCalls.forEach((toolCall: unknown) => {
          // Handle both OpenAI format (with function property) and Gemini format (direct name/args)
          const tc = toolCall as {
            function?: { name: string; arguments: string };
            name?: string;
            args?: unknown;
          };

          let toolName: string;
          let toolArgs: unknown;

          if (tc.function) {
            // OpenAI format
            toolName = tc.function.name;
            try {
              toolArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (error) {
              console.error('Error parsing OpenAI tool call arguments:', error);
              toolArgs = {};
            }
          } else if (tc.name) {
            // Gemini format
            toolName = tc.name;
            toolArgs = tc.args || {};
          } else {
            console.error('Unknown tool call format:', tc);
            return;
          }

          parts.push({
            functionCall: {
              name: toolName,
              args: toolArgs,
            },
          });
        });

        const assistantMessage: Record<string, unknown> = {
          role: MESSAGE_ROLES.MODEL, // Use "model" role for Gemini
          parts: parts,
        };
        ws.send(JSON.stringify(assistantMessage));
      }
    }
  }

  // logConversationMemory and manageConversationId are now inherited from BaseServiceProvider
}
