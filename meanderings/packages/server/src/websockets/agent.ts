import { WebSocket } from 'ws';
import { Message, UserRequest, ContentBlock, MessagePart } from '../shared/types/index.js';
import { AgentConfigManager } from '../shared/config/agent-config.js';
import { ServiceFactory } from '../shared/services/service-factory.js';
import { MESSAGE_ROLES } from '../shared/constants/message-constants.js';
import winston from 'winston';

export class AgentWebSocketHandler {
  static handleConnection(logger: winston.Logger, ws: WebSocket, agentType: string): void {
    logger.info(`WebSocket connection for agent type '${agentType}' opened.`);

    try {
      // Get agent configuration manager
      const configManager = AgentConfigManager.getInstance();

      // Validate agent type - check if agent exists in configurations
      if (!configManager.hasAgent(agentType)) {
        const errorMessage = `Invalid agent type: ${agentType}`;
        const availableAgents = configManager.getAgentNames();
        ws.send(
          JSON.stringify({
            error: errorMessage,
            available_agents: availableAgents,
          })
        );
        ws.close();
        return;
      }

      // Get agent configuration
      const agentConfig = configManager.getAgentConfig(agentType);
      if (!agentConfig) {
        ws.send(JSON.stringify({ error: `Agent configuration not found: ${agentType}` }));
        ws.close();
        return;
      }

      // Create service provider directly using ServiceFactory
      const serviceProvider = ServiceFactory.createServiceProvider(agentConfig);

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        void (async () => {
          try {
            const message = data.toString();
            logger.info(`Received Request: ${message} for agent type '${agentType}'`);

            let userRequest: UserRequest;
            try {
              userRequest = JSON.parse(message) as UserRequest;
            } catch (error) {
              logger.error('Invalid JSON payload:', error);
              ws.send(JSON.stringify({ error: 'Invalid request payload' }));
              return;
            }

            // Handle file uploads
            if (userRequest.fileId) {
              // Set file path for processing (if needed by tools)
              process.env.CURRENT_FILE_PATH = `uploads/${userRequest.fileId}`;
            }

            // Filter and clean messages
            const filteredMessages = AgentWebSocketHandler.filterMessages(
              userRequest.chat_messages || []
            );

            try {
              // Process the request and send the response
              const result = await serviceProvider.makeApiCall(
                filteredMessages,
                userRequest.user_input || '',
                ws,
                agentConfig.do_stream
              );

              logger.info(`Response sent for agent type '${agentType}'`);

              // Log conversation memory using complete API conversation history
              // This includes all tool calls and function responses that occurred during the API call
              // Type guard for result
              if (result && typeof result === 'object' && 'completeMessages' in result) {
                serviceProvider.logConversationMemory(result.completeMessages as Message[]);
              }
            } catch (error: unknown) {
              logger.error('Agent makeApiCall failed:', error);

              // Translate common errors to user-friendly messages
              const userFriendlyMessage = AgentWebSocketHandler.translateError(
                error,
                serviceProvider.service_provider
              );

              try {
                // Send both formats for compatibility with text and voice modes
                ws.send(JSON.stringify({ sentence: userFriendlyMessage, final_sentence: true }));
                ws.send(
                  JSON.stringify({ role: MESSAGE_ROLES.ASSISTANT, content: userFriendlyMessage })
                );
                ws.send(JSON.stringify({ done: true }));
              } catch (sendError) {
                logger.error('Failed to send error message:', sendError);
              }
            }
          } catch (error) {
            logger.error('Error processing WebSocket message:', error);
            ws.send(JSON.stringify({ error: 'Internal server error' }));
          }
        })();
      });

      ws.on('close', () => {
        logger.info(`WebSocket connection for agent type '${agentType}' has been disconnected.`);
      });

      ws.on('error', (error: Error) => {
        logger.error(`WebSocket error in agent '${agentType}':`, error);
      });
    } catch (error) {
      logger.error(`Failed to create agent '${agentType}':`, error);
      ws.send(JSON.stringify({ error: `Failed to initialize agent: ${(error as Error).message}` }));
      ws.close();
    }
  }

  private static filterMessages(messages: Message[]): Message[] {
    const filtered: Message[] = [];

    // Track tool_use IDs to ensure proper pairing with tool_result blocks
    const pendingToolUseIds = new Set<string>();
    const pendingOpenAIToolCallIds = new Set<string>();

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') {
        continue;
      }

      const filteredMsg: Message = {
        role: msg.role,
      };

      // Only add content if it exists (avoid None values)
      if (msg.content !== null && msg.content !== undefined) {
        if (typeof msg.content === 'string') {
          filteredMsg.content = msg.content;
        } else if (Array.isArray(msg.content)) {
          filteredMsg.content = msg.content;
        }
      }

      // Handle parts format (provider-agnostic style)
      if (msg.parts && Array.isArray(msg.parts)) {
        // Clean parts to remove invalid fields
        const cleanedParts: MessagePart[] = [];
        for (const part of msg.parts) {
          if (typeof part === 'object' && part !== null) {
            // Create provider-agnostic part with extensible properties
            const cleanedPart: MessagePart = {};

            if ('text' in part && typeof part.text === 'string') {
              cleanedPart.text = part.text;
            }
            // Handle provider-specific function call formats via extensible properties
            if ('functionCall' in part) {
              cleanedPart.functionCall = part.functionCall;
            }
            if ('functionResponse' in part) {
              cleanedPart.functionResponse = part.functionResponse;
            }

            if (Object.keys(cleanedPart).length > 0) {
              cleanedParts.push(cleanedPart);
            }
          }
        }

        // Always remove content field when using parts array format
        delete filteredMsg.content;

        if (cleanedParts.length > 0) {
          filteredMsg.parts = cleanedParts;
        } else {
          // If no valid parts, skip this message
          continue;
        }

        // Track provider-agnostic function calls and responses
        for (const part of cleanedParts) {
          if (
            'functionCall' in part &&
            part.functionCall &&
            typeof part.functionCall === 'object' &&
            'name' in part.functionCall &&
            typeof part.functionCall.name === 'string'
          ) {
            pendingToolUseIds.add(`provider_${part.functionCall.name}`);
          } else if (
            'functionResponse' in part &&
            part.functionResponse &&
            typeof part.functionResponse === 'object' &&
            'name' in part.functionResponse &&
            typeof part.functionResponse.name === 'string'
          ) {
            pendingToolUseIds.delete(`provider_${part.functionResponse.name}`);
          }
        }
      }

      // Handle OpenAI/Groq tool_calls format
      if (msg.tool_calls) {
        filteredMsg.tool_calls = msg.tool_calls;
        // Track OpenAI-style tool calls
        for (const toolCall of msg.tool_calls) {
          if (toolCall && toolCall.id) {
            pendingOpenAIToolCallIds.add(toolCall.id);
          }
        }
      }

      // Handle OpenAI/Groq tool response format (role: "tool")
      if (msg.role === MESSAGE_ROLES.TOOL) {
        if (msg.tool_call_id) {
          filteredMsg.tool_call_id = msg.tool_call_id;
          // Mark OpenAI tool call as resolved
          pendingOpenAIToolCallIds.delete(msg.tool_call_id);
        }
        if (msg.name) {
          filteredMsg.name = msg.name;
        }
      }

      // For Anthropic API: Handle tool_use and tool_result blocks properly
      if (Array.isArray(filteredMsg.content)) {
        const contentBlocks: ContentBlock[] = [];
        for (const block of filteredMsg.content) {
          if (typeof block === 'object' && block !== null) {
            if (block.type === 'tool_use' && 'id' in block && typeof block.id === 'string') {
              // Track tool_use IDs
              pendingToolUseIds.add(block.id);
              contentBlocks.push(block);
            } else if (
              block.type === 'tool_result' &&
              'tool_use_id' in block &&
              typeof block.tool_use_id === 'string'
            ) {
              // Remove tool_use ID from pending if this is its result
              pendingToolUseIds.delete(block.tool_use_id);
              contentBlocks.push(block);
            } else {
              // Keep other content blocks (text, etc.)
              contentBlocks.push(block);
            }
          }
        }
        filteredMsg.content = contentBlocks;
      }

      filtered.push(filteredMsg);
    }

    // Remove any messages that have orphaned tool calls/tool_use blocks
    if (pendingToolUseIds.size > 0 || pendingOpenAIToolCallIds.size > 0) {
      // Note: This method doesn't have access to logger, keeping original console.warn for now
      console.warn('Removing messages with orphaned tool calls:', {
        anthropic: Array.from(pendingToolUseIds),
        openai: Array.from(pendingOpenAIToolCallIds),
      });

      return filtered.filter((msg) => {
        if (typeof msg !== 'object') return true;

        // Handle Anthropic-style content blocks
        if (Array.isArray(msg.content)) {
          const filteredContent = msg.content.filter((block: unknown) => {
            if (
              block &&
              typeof block === 'object' &&
              'type' in block &&
              'id' in block &&
              block.type === 'tool_use' &&
              typeof block.id === 'string'
            ) {
              return !pendingToolUseIds.has(block.id);
            }
            return true;
          });

          if (filteredContent.length > 0) {
            msg.content = filteredContent;
            return true;
          }
          return false;
        }

        // Handle OpenAI-style tool_calls
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          const filteredToolCalls = msg.tool_calls.filter(
            (toolCall) => !pendingOpenAIToolCallIds.has(toolCall.id || '')
          );

          if (filteredToolCalls.length > 0) {
            msg.tool_calls = filteredToolCalls;
            return true;
          } else if (!msg.content) {
            return false; // Skip if this was purely a tool_calls message with no content
          }
        }

        // Handle provider-agnostic parts
        if (msg.parts && Array.isArray(msg.parts)) {
          const filteredParts = msg.parts.filter((part: unknown) => {
            if (
              part &&
              typeof part === 'object' &&
              'functionCall' in part &&
              part.functionCall &&
              typeof part.functionCall === 'object' &&
              'name' in part.functionCall &&
              typeof part.functionCall.name === 'string'
            ) {
              return !pendingToolUseIds.has(`provider_${part.functionCall.name}`);
            }
            return true;
          });

          if (filteredParts.length > 0) {
            msg.parts = filteredParts;
            return true;
          }
          return false;
        }

        return true;
      });
    }

    return filtered;
  }

  private static translateError(error: unknown, serviceProvider: string): string {
    let errorMsg = 'Unknown error';

    if (error instanceof Error) {
      errorMsg = error.message;
    } else if (typeof error === 'string') {
      errorMsg = error;
    } else if (error && typeof error === 'object') {
      // Try to extract meaningful error information from object
      if ('message' in error && typeof error.message === 'string') {
        errorMsg = error.message;
      } else if ('code' in error && typeof error.code === 'string') {
        errorMsg = `Error code: ${error.code}`;
      } else {
        errorMsg = 'Error object (no message available)';
      }
    }

    let userFriendlyMsg = 'Configuration Error: ';

    if (errorMsg.includes("'str' object has no attribute 'get'")) {
      userFriendlyMsg += `Invalid model configuration. Please check your model settings.`;
    } else if (errorMsg.includes('404 Not Found') && errorMsg.includes('11434')) {
      userFriendlyMsg += 'Ollama service not running. Please start Ollama first.';
    } else if (errorMsg.includes('404 Not Found') && errorMsg.includes('1234')) {
      userFriendlyMsg += 'LMStudio service not running. Please start LMStudio first.';
    } else if (errorMsg.includes('Connection refused') || errorMsg.includes('ConnectError')) {
      userFriendlyMsg += `Cannot connect to ${serviceProvider} service. Please check if the service is running.`;
    } else if (errorMsg.includes('Model') && errorMsg.includes('not found')) {
      userFriendlyMsg += `Model not found. Please check available models for ${serviceProvider}.`;
    } else if (errorMsg.includes('All connection attempts failed')) {
      userFriendlyMsg += `${serviceProvider} service unavailable. Please check configuration and network connectivity.`;
    } else if (errorMsg.includes('API key')) {
      userFriendlyMsg += `Missing or invalid API key for ${serviceProvider}. Please check your environment configuration.`;
    } else {
      userFriendlyMsg += `Unexpected error occurred with ${serviceProvider}. Details: ${errorMsg}`;
    }

    return userFriendlyMsg;
  }
}
