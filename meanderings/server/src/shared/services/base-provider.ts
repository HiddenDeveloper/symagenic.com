import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { AgentConfig, Message, ServiceProvider, ToolRegistry, UsageInfo } from '../types/index.js';
import { ToolRegistryManagerAdapter } from '../tools/dynamic-tool-registry.js';
import { _TOOL_REGISTRY } from '../tools/tool-function-decorator.js';
import { MESSAGE_ROLES } from '@ailumina/shared';
import { sanitizeToolName, ToolNameMapping } from '../utils/tool-name-sanitizer.js';

/**
 * Base class for all AI service providers
 * Implements common functionality to avoid code duplication
 */
export abstract class BaseServiceProvider implements ServiceProvider {
  public agent_name: string;
  public service_provider: string;
  public model_name: string;
  public tool_registry?: ToolRegistry;
  public usage_info: UsageInfo = {};
  protected system_prompt?: string;
  protected toolRegistryAdapter?: ToolRegistryManagerAdapter;
  protected toolNameMapping: Map<string, ToolNameMapping> = new Map();

  constructor(
    agentConfig: AgentConfig,
    serviceProvider: string,
    toolRegistry?: ToolRegistry,
    toolRegistryAdapter?: ToolRegistryManagerAdapter
  ) {
    this.agent_name = agentConfig.agent_name;
    this.service_provider = serviceProvider;
    this.model_name = agentConfig.model_name;
    this.tool_registry = toolRegistry;
    this.system_prompt = agentConfig.system_prompt;

    // Use provided adapter if provided
    this.toolRegistryAdapter = toolRegistryAdapter;
  }

  /**
   * Abstract method that each provider must implement
   * Returns both the response and complete conversation history for logging
   */
  abstract makeApiCall(
    messages: Message[],
    userInput: string,
    websocket?: unknown,
    streamResponse?: boolean
  ): Promise<{ response: unknown; completeMessages: Message[] }>;

  /**
   * Abstract method for transforming tool registry to provider-specific format
   */
  abstract transformToolRegistry(): unknown[];

  /**
   * Common WebSocket message sending for state machine compatibility
   */
  protected sendWebSocketMessages(
    websocket: unknown,
    content: string,
    toolCalls?: unknown[],
    isFinal = true
  ): void {
    if (!websocket) return;

    // Type guard for WebSocket
    const ws = websocket as { send: (data: string) => void };

    if (isFinal) {
      // Send sentence format for state machine
      // Only send a sentence if there's actual content or tool calls
      const sentence = content || (toolCalls && toolCalls.length > 0 ? JSON.stringify(toolCalls) : '');

      // Only send sentence message if there's actual content
      if (sentence) {
        ws.send(
          JSON.stringify({
            sentence: sentence,
            final_sentence: true,
          })
        );
      }

      // Send role/content format for message display
      // Only send if there's content or tool calls
      if (content || (toolCalls && toolCalls.length > 0)) {
        const finalMessage: Record<string, unknown> = {
          role: MESSAGE_ROLES.ASSISTANT,
          content: content,
          final_sentence: true,
        };

        if (toolCalls && toolCalls.length > 0) {
          finalMessage.tool_calls = toolCalls;
        }

        ws.send(JSON.stringify(finalMessage));
      }

      // Send done signal to transition state machine back to WAITING_FOR_INPUT
      ws.send(JSON.stringify({ done: true }));
    } else {
      // Streaming message - only send if there's actual content
      if (content) {
        ws.send(
          JSON.stringify({
            sentence: content,
            final_sentence: false,
          })
        );
      }

      // If this is a tool call message, also send the assistant format
      if (toolCalls && toolCalls.length > 0) {
        const assistantMessage: Record<string, unknown> = {
          role: MESSAGE_ROLES.ASSISTANT,
          content: content,
          tool_calls: toolCalls,
        };
        ws.send(JSON.stringify(assistantMessage));
      }
    }
  }

  /**
   * Common conversation memory logging
   */
  logConversationMemory(messages: Message[]): string | null {
    try {
      const conversationId = this.manageConversationId();

      const scratchPadDir = process.env.SCRATCH_PAD_DIR || 'api/scratchpad';
      const filename = `${scratchPadDir}/${conversationId}.json`;

      const memoryLog = {
        identity_info: {
          agent_name: this.agent_name,
          conversation_id: conversationId,
          created_datetime: new Date().toISOString(),
          model: this.model_name,
          service_provider: this.service_provider,
        },
        messages: messages,
        usage_info: this.formatUsageInfo(),
      };

      // Ensure directory exists
      mkdirSync(dirname(filename), { recursive: true });

      // Write conversation log
      writeFileSync(filename, JSON.stringify(memoryLog, null, 2), 'utf8');

      console.log(`Conversation memory updated in ${filename}`);

      return conversationId;
    } catch (error) {
      console.error('Error logging conversation memory:', error);
      return null;
    }
  }

  /**
   * Format usage info for different providers
   */
  protected formatUsageInfo(): Record<string, unknown> {
    // Handle different provider token naming conventions
    const inputTokens = this.usage_info.input_tokens || this.usage_info.prompt_tokens || 0;
    const outputTokens = this.usage_info.output_tokens || this.usage_info.completion_tokens || 0;
    const totalTokens = this.usage_info.total_tokens || inputTokens + outputTokens;

    return {
      cache_creation_input_tokens: this.usage_info.cache_creation_input_tokens || 0,
      cache_read_input_tokens: this.usage_info.cache_read_input_tokens || 0,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      original: this.usage_info,
    };
  }

  /**
   * Generate conversation ID
   */
  protected manageConversationId(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '')
      .replace('T', '_')
      .substring(0, 15);

    return `${timestamp}_${this.agent_name}`;
  }

  /**
   * Common tool registry transformation logic
   * Now uses the dynamic tool registry instead of the old hard-coded system
   */
  protected transformToolsBase(
    formatFunction: (name: string, tool: unknown) => unknown
  ): unknown[] {
    const transformedTools: unknown[] = [];

    // Priority 1: Use instance tool registry if available (includes agent-filtered tools)
    if (this.tool_registry !== undefined) {
      // Use the instance tool registry, even if empty (respects agent configuration)
      for (const [originalName, tool] of Object.entries(this.tool_registry)) {
        // Sanitize tool name for provider compatibility
        const sanitizedName = sanitizeToolName(originalName);

        // Store mapping for reverse lookup when LLM calls the tool
        this.toolNameMapping.set(sanitizedName, { original: originalName, sanitized: sanitizedName });
        this.toolNameMapping.set(originalName, { original: originalName, sanitized: sanitizedName });

        // Pass sanitized name to format function
        const result = formatFunction(sanitizedName, tool);
        if (result !== null) {
          transformedTools.push(result);
        }
      }
    } else {
      // Priority 2: Use the dynamic tool registry (fallback for legacy cases)
      for (const [originalName, toolEntry] of _TOOL_REGISTRY.entries()) {
        // Skip old mcp_ prefixed tools (legacy check)
        if (originalName.startsWith('mcp_')) {
          continue;
        }

        if (toolEntry.definition.enabled) {
          // Sanitize tool name for provider compatibility
          const sanitizedName = sanitizeToolName(originalName);

          // Store mapping for reverse lookup when LLM calls the tool
          this.toolNameMapping.set(sanitizedName, { original: originalName, sanitized: sanitizedName });
          this.toolNameMapping.set(originalName, { original: originalName, sanitized: sanitizedName });

          // Pass sanitized name to format function
          const result = formatFunction(sanitizedName, toolEntry.definition);
          if (result !== null) {
            transformedTools.push(result);
          }
        }
      }
    }

    return transformedTools;
  }

  /**
   * Get original tool name from sanitized name
   * Used when LLM returns tool calls with sanitized names
   */
  protected getOriginalToolName(sanitizedName: string): string {
    const mapping = this.toolNameMapping.get(sanitizedName);
    return mapping?.original || sanitizedName;
  }

  /**
   * Ensure system prompt is included in messages if configured
   */
  protected ensureSystemPrompt(messages: Message[]): Message[] {
    if (!this.system_prompt) {
      return messages;
    }

    // Check if messages already contain a system message
    const hasSystemMessage = messages.some((msg) => msg.role === MESSAGE_ROLES.SYSTEM);

    if (!hasSystemMessage) {
      // Add system prompt as first message
      return [{ role: MESSAGE_ROLES.SYSTEM, content: this.system_prompt }, ...messages];
    }

    return messages;
  }

  /**
   * Abstract methods that each provider must implement for tool call handling
   */
  abstract extractPartsFromResponse(response: unknown): {
    fullMessage: unknown;
    usageInfo: unknown;
    toolUse: unknown;
    text: string | null;
    stopReason: string;
  };

  abstract extractToolCallInfo(toolCall: unknown): {
    id: string;
    name: string;
    arguments: string;
  };

  abstract formatToolResponseMessage(
    functionResult: string,
    toolName: string,
    toolCallId: string
  ): Message;

  /**
   * Update the tool registry adapter with a new dynamic registry
   */
  public setToolRegistryAdapter(adapter: ToolRegistryManagerAdapter): void {
    this.toolRegistryAdapter = adapter;
  }

  /**
   * Critical method: Synchronize message context to client
   * This detects tool calls, executes them server-side, and makes recursive API calls
   * Based on Python version's _synchronize_message_context_to_client
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
        return null;
      }

      // Extract tool call information using provider-specific method
      const {
        id: toolCallId,
        name: toolName,
        arguments: toolArgs,
      } = this.extractToolCallInfo(toolCall);

      console.log(`Executing tool: ${toolName} with args: ${toolArgs}`);

      // Send tool status "started" message matching Python format
      if (websocket) {
        const ws = websocket as { send: (data: string) => void };
        ws.send(
          JSON.stringify({
            tool_status: 'started',
            tool_name: toolName,
            run_type: 'server',
          })
        );
      }

      // Add the assistant message with tool call to conversation
      const assistantMessage: Message = {
        role: MESSAGE_ROLES.ASSISTANT,
        content: messageContent || '',
        tool_calls: [toolCall],
      };
      messages.push(assistantMessage);

      // Send assistant tool call message to WebSocket for complete conversation history
      // Always send when there are tool calls, even if content is empty
      if (websocket) {
        this.sendWebSocketMessages(websocket, messageContent || '', [toolCall], false);
      }

      // Execute the tool and handle errors properly
      let functionResult: string;
      let toolExecutionSuccess = true;
      const startTime = performance.now();

      try {
        functionResult = await this.invokeTool(toolName, toolArgs);
      } catch (error) {
        // Convert tool execution error to a result that can be fed back to the AI
        functionResult = `Error: ${error instanceof Error ? error.message : 'Tool execution failed'}`;
        toolExecutionSuccess = false;
        console.log(`Tool execution failed for '${toolName}': ${functionResult}`);
      }

      const executionTime = (performance.now() - startTime) / 1000; // Convert to seconds

      // Send tool status "completed" message matching Python format
      if (websocket) {
        const statusMessage: Record<string, unknown> = {
          tool_status: toolExecutionSuccess ? 'completed' : 'error',
          tool_name: toolName,
          run_type: 'server',
          execution_time: executionTime,
        };

        if (!toolExecutionSuccess) {
          statusMessage.details = functionResult;
        }

        const ws = websocket as { send: (data: string) => void };
        ws.send(JSON.stringify(statusMessage));
      }

      // Create tool response message using provider-specific format
      const toolResponseMessage = this.formatToolResponseMessage(
        functionResult,
        toolName,
        toolCallId
      );

      // Add tool result to conversation
      messages.push(toolResponseMessage);

      // Send tool result message to WebSocket for complete conversation history
      if (websocket) {
        // Send tool result as a separate message
        const ws = websocket as { send: (data: string) => void };
        ws.send(
          JSON.stringify({
            role: MESSAGE_ROLES.TOOL,
            name: toolName,
            content: functionResult,
            tool_call_id: toolCallId,
          })
        );
      }

      // Send tool status messages matching Python format - NO LONGER NEEDED
      // The Python version doesn't send this format - it only sends tool_status messages
      // which are handled by the individual service providers

      // Make recursive API call to get final response after tool execution
      console.log('Making recursive API call after tool execution...');
      const recursiveResult = await this.makeApiCall(messages, '', undefined, doStream);

      // Ensure the final response is sent to WebSocket
      if (recursiveResult.response && websocket) {
        // Type guard for response structure
        const response = recursiveResult.response as { content?: string | { text?: string }[] };

        let responseContent: string | null = null;
        if (typeof response.content === 'string') {
          responseContent = response.content;
        } else if (Array.isArray(response.content) && response.content.length > 0) {
          const firstItem = response.content[0] as { text?: string };
          responseContent = firstItem.text || JSON.stringify(response.content);
        } else if (response.content !== undefined) {
          responseContent = JSON.stringify(response.content);
        }

        if (responseContent) {
          this.sendWebSocketMessages(websocket, responseContent, undefined, true);
        }
      }

      return recursiveResult.response;
    } catch (error) {
      console.error('Error in synchronizeMessageContextToClient:', error);

      if (websocket) {
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
   * Invoke a tool by name with arguments
   * Uses the dynamic tool registry to execute the tool
   */
  protected async invokeTool(toolName: string, toolArgsString: string): Promise<string> {
    try {
      // Parse tool arguments with proper type safety
      let toolArgs = JSON.parse(toolArgsString) as Record<string, unknown>;

      // Unwrap incorrectly nested parameters (some LLMs wrap params under dummy keys)
      // If there's only one key and its value is an object, unwrap it
      const keys = Object.keys(toolArgs);
      if (keys.length === 1 && typeof toolArgs[keys[0]] === 'object' && toolArgs[keys[0]] !== null) {
        const potentialWrapper = toolArgs[keys[0]] as Record<string, unknown>;
        // Check if the wrapped object has the expected parameter names
        if (Object.keys(potentialWrapper).length > 0) {
          console.log(`[invokeTool] Unwrapping nested parameters for ${toolName}: ${keys[0]} -> direct params`);
          toolArgs = potentialWrapper;
        }
      }

      // Create tool context
      const toolContext = {
        agentName: this.agent_name,
        // Add any custom settings if available
      };

      // Execute the tool using the dynamic registry adapter
      if (!this.toolRegistryAdapter) {
        throw new Error('Tool registry adapter not initialized');
      }
      const result = await this.toolRegistryAdapter.executeTool(toolName, toolArgs, toolContext);

      // Convert result to string for consistency
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error) {
      console.error(`Error executing tool '${toolName}':`, error);
      throw new Error(
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
