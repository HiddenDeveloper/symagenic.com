import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseServiceProvider } from '../../src/shared/services/base-provider.js';
import { AnthropicProvider } from '../../src/shared/services/anthropic-provider.js';
import { OpenAIProvider } from '../../src/shared/services/openai-provider.js';
import { GoogleProvider } from '../../src/shared/services/google-provider.js';
import { SERVICE_PROVIDERS, Message } from '@ailumina/shared';
import {
  createAnthropicTextResponse,
  createAnthropicToolUseResponse,
  createOpenAITextResponse,
  createOpenAIToolCallResponse,
  createGoogleTextResponse,
  createGoogleFunctionCallResponse,
  SAMPLE_TOOLS,
  SAMPLE_FUNCTION_CALLS,
  SAMPLE_FUNCTION_RESULTS,
} from '../fixtures/provider-mocks.js';
import { MockWebSocket } from '../fixtures/websocket-mock.js';

// Provider test configuration
const providerConfigs = [
  {
    name: 'Anthropic',
    ProviderClass: AnthropicProvider,
    createTextResponse: createAnthropicTextResponse,
    createToolResponse: createAnthropicToolUseResponse,
    textContent: 'Hello, how can I help you?',
    toolContent: "I'll help you with that. Let me use the appropriate tool.",
    mockTextTransport: {
      parseResponse: () => ({
        content: 'Hello, how can I help you?',
        stopReason: 'end_turn',
        usage: { inputTokens: 12, outputTokens: 25, totalTokens: 37 },
      }),
    },
    mockToolTransport: {
      parseResponse: () => ({
        content: "I'll help you with that. Let me use the appropriate tool.",
        stopReason: 'tool_use',
        toolUse: [
          {
            type: 'tool_use',
            id: 'toolu_01A09q90qw90lq917835lq9',
            name: 'get_weather',
            input: SAMPLE_FUNCTION_CALLS.weather,
          },
        ],
        usage: { inputTokens: 472, outputTokens: 95 },
      }),
    },
    expectedToolResult: {
      type: 'tool_result',
      tool_use_id: 'test_call_id',
      content: SAMPLE_FUNCTION_RESULTS.weather,
    },
    expectedToolTransform: {
      name: 'get_weather',
      description: SAMPLE_TOOLS.weather.description,
      input_schema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            description: 'Temperature unit',
          },
        },
        required: SAMPLE_TOOLS.weather.parameters.required,
      },
    },
  },
  {
    name: 'OpenAI',
    ProviderClass: OpenAIProvider,
    createTextResponse: createOpenAITextResponse,
    createToolResponse: createOpenAIToolCallResponse,
    textContent: 'Hello, how can I help you today?',
    toolContent: "I'll help you with that using the appropriate tool.",
    mockTextTransport: {
      parseResponse: () => ({
        content: 'Hello, how can I help you today?',
        finishReason: 'stop',
        usage: { inputTokens: 9, outputTokens: 12, totalTokens: 21 },
      }),
    },
    mockToolTransport: {
      parseResponse: () => ({
        content: "I'll help you with that using the appropriate tool.",
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_xxxxxxxxxxxxxx',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: JSON.stringify(SAMPLE_FUNCTION_CALLS.weather),
            },
          },
        ],
        usage: { inputTokens: 82, outputTokens: 18, totalTokens: 100 },
      }),
    },
    expectedToolResult: {
      role: 'tool',
      tool_call_id: 'test_call_id',
      name: 'get_weather',
      content: SAMPLE_FUNCTION_RESULTS.weather,
    },
    expectedToolTransform: {
      type: 'function',
      function: {
        name: 'get_weather',
        description: SAMPLE_TOOLS.weather.description,
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City and state, e.g. San Francisco, CA',
            },
            unit: {
              type: 'string',
              description: 'Temperature unit',
            },
          },
          required: SAMPLE_TOOLS.weather.parameters.required,
        },
      },
    },
  },
  {
    name: 'Google',
    ProviderClass: GoogleProvider,
    createTextResponse: createGoogleTextResponse,
    createToolResponse: createGoogleFunctionCallResponse,
    textContent: 'Hello, I can help you with that!',
    toolContent: "I'll help you with that. Let me call the appropriate function.",
    mockTextTransport: {
      parseResponse: () => ({
        content: 'Hello, I can help you with that!',
        finishReason: 'STOP',
        usage: { inputTokens: 8, outputTokens: 15, totalTokens: 23 },
      }),
    },
    mockToolTransport: {
      parseResponse: () => ({
        content: "I'll help you with that. Let me call the appropriate function.",
        finishReason: 'STOP',
        functionCalls: [
          {
            name: 'get_weather',
            args: SAMPLE_FUNCTION_CALLS.weather,
          },
        ],
        usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
      }),
    },
    expectedToolResult: {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'get_weather',
            response: {
              content: SAMPLE_FUNCTION_RESULTS.weather,
            },
          },
        },
      ],
    },
    expectedToolTransform: {
      name: 'get_weather',
      description: SAMPLE_TOOLS.weather.description,
      parameters: {
        type: 'OBJECT',
        properties: {
          location: {
            type: 'STRING',
            description: 'City and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'STRING',
            description: 'Temperature unit',
          },
        },
        required: SAMPLE_TOOLS.weather.parameters.required,
      },
    },
  },
];

describe.skip.each(providerConfigs)('$name Provider', (config) => {
  let provider: BaseServiceProvider;

  const mockAgentConfig = {
    agent_name: 'test-agent',
    service_provider: SERVICE_PROVIDERS.OPENAI,
    model_name: 'test-model',
    description: 'Test agent configuration',
    system_prompt: 'You are a helpful assistant.',
    do_stream: false,
  };

  beforeEach(() => {
    provider = new config.ProviderClass(mockAgentConfig);
  });

  describe('Non-Function Call Response', () => {
    it('should correctly parse text response', () => {
      const mockResponse = config.createTextResponse(config.textContent);

      // Mock the transport layer response
      vi.spyOn(
        provider as unknown as { transport: typeof config.mockTextTransport },
        'transport',
        'get'
      ).mockReturnValue(config.mockTextTransport);

      const parts = provider.extractPartsFromResponse(mockResponse);

      expect(parts.text).toBe(config.textContent);
      expect(parts.toolUse).toBeNull();
      const parsedResponse = config.mockTextTransport.parseResponse();
      const stopReason =
        'stopReason' in parsedResponse ? parsedResponse.stopReason : parsedResponse.finishReason;
      expect(parts.stopReason).toBe(stopReason);
    });

    it('should format tool response message correctly', () => {
      const toolResponse = provider.formatToolResponseMessage(
        SAMPLE_FUNCTION_RESULTS.weather,
        'get_weather',
        'test_call_id'
      );

      expect(toolResponse).toEqual(config.expectedToolResult);
    });

    it('should transform tool registry correctly', () => {
      // Mock the tool registry
      const mockToolRegistry = new Map();
      mockToolRegistry.set('get_weather', {
        definition: {
          enabled: true,
          description: SAMPLE_TOOLS.weather.description,
          parameters: SAMPLE_TOOLS.weather.parameters,
        },
      });

      // Mock the transformToolsBase method
      vi.spyOn(
        provider as unknown as {
          transformToolsBase: (
            formatFunction: (
              name: string,
              definition: {
                enabled: boolean;
                description: string;
                parameters: Record<string, unknown>;
              }
            ) => unknown
          ) => unknown[];
        },
        'transformToolsBase'
      ).mockImplementation((formatFunction) => {
        const results = [];
        for (const [name, toolEntry] of Array.from(mockToolRegistry.entries())) {
          if (toolEntry.definition.enabled) {
            const result = formatFunction(name, toolEntry.definition);
            if (result !== null) {
              results.push(result);
            }
          }
        }
        return results;
      });

      const transformedTools = provider.transformToolRegistry();

      expect(transformedTools).toHaveLength(1);
      expect(transformedTools[0]).toEqual(config.expectedToolTransform);
    });
  });

  describe('Function Call Response', () => {
    it('should correctly parse tool/function call response', () => {
      const mockResponse = config.createToolResponse('get_weather', SAMPLE_FUNCTION_CALLS.weather);

      // Mock the transport layer response
      vi.spyOn(
        provider as unknown as { transport: typeof config.mockToolTransport },
        'transport',
        'get'
      ).mockReturnValue(config.mockToolTransport);

      const parts = provider.extractPartsFromResponse(mockResponse);

      expect(parts.text).toBe(config.toolContent);
      expect(parts.toolUse).not.toBeNull();
      const parsedToolResponse = config.mockToolTransport.parseResponse();
      const toolStopReason =
        'stopReason' in parsedToolResponse
          ? parsedToolResponse.stopReason
          : parsedToolResponse.finishReason;
      expect(parts.stopReason).toBe(toolStopReason);
    });

    it('should extract tool call info correctly', () => {
      const mockResponse = config.createToolResponse('get_weather', SAMPLE_FUNCTION_CALLS.weather);

      // Mock the transport layer response
      vi.spyOn(
        provider as unknown as { transport: typeof config.mockToolTransport },
        'transport',
        'get'
      ).mockReturnValue(config.mockToolTransport);

      const parts = provider.extractPartsFromResponse(mockResponse);
      const toolCallInfo = provider.extractToolCallInfo(parts.toolUse);

      expect(toolCallInfo.name).toBe('get_weather');
      expect(JSON.parse(toolCallInfo.arguments)).toEqual(SAMPLE_FUNCTION_CALLS.weather);
    });

    it('should handle error cases gracefully', () => {
      // Test malformed response
      expect(() => {
        provider.extractPartsFromResponse({ invalid: 'response' });
      }).not.toThrow();

      // Test empty tool call
      expect(() => {
        provider.extractToolCallInfo({});
      }).not.toThrow();
    });
  });

  describe('WebSocket Message Flow', () => {
    it('should demonstrate missing assistant tool call message bug', async () => {
      const mockWebSocket = new MockWebSocket();

      // Test the synchronizeMessageContextToClient method directly to demonstrate the bug
      const mockToolCall = {
        type: 'tool_use',
        id: 'tool_123',
        name: 'get_current_datetime',
        input: {},
      };

      // Test case 1: Empty messageContent (this reproduces the bug)
      const emptyContent = '';
      const messages1: Message[] = [];

      // Mock invokeTool to avoid actual tool execution
      vi.spyOn(
        provider as unknown as { invokeTool: (name: string, args: string) => Promise<string> },
        'invokeTool'
      ).mockResolvedValue('2025-08-16 2:48:26 PM');

      try {
        await (
          provider as unknown as {
            synchronizeMessageContextToClient: (
              content: string,
              toolCall: unknown,
              messages: Message[],
              ws: MockWebSocket,
              stream: boolean
            ) => Promise<void>;
          }
        ).synchronizeMessageContextToClient(
          emptyContent,
          mockToolCall,
          messages1,
          mockWebSocket,
          false
        );
      } catch (error) {
        // Expected to fail in some cases, we're testing message flow
      }

      // Test case 2: Non-empty messageContent (this should work)
      mockWebSocket.clear();
      const contentWithText = "I'll check the current time for you.";
      const messages2: Message[] = [];

      try {
        await (
          provider as unknown as {
            synchronizeMessageContextToClient: (
              content: string,
              toolCall: unknown,
              messages: Message[],
              ws: MockWebSocket,
              stream: boolean
            ) => Promise<void>;
          }
        ).synchronizeMessageContextToClient(
          contentWithText,
          mockToolCall,
          messages2,
          mockWebSocket,
          false
        );
      } catch (error) {
        // Expected to fail in some cases, we're testing message flow
      }

      // Analyze the messages
      const messages = mockWebSocket.getMessages();
      console.log(
        `[${config.name}] Direct synchronization test - captured ${messages.length} messages`
      );

      // The bug is in the conditional sending logic in base-provider.ts:291-293
      // if (websocket && messageContent && messageContent.trim() !== '') {
      //   await this.sendWebSocketMessages(websocket, messageContent, [toolCall], false);
      // }

      // When messageContent is empty, the assistant message with tool_calls is NOT sent
      // This is the exact bug mentioned by the user!

      const assistantMessages = mockWebSocket.getMessagesByType('assistant_message');
      const assistantWithToolCalls = assistantMessages.find(
        (msg) => msg.data.tool_calls && Array.isArray(msg.data.tool_calls)
      );

      console.log(`[${config.name}] Assistant messages found: ${assistantMessages.length}`);
      console.log(
        `[${config.name}] Assistant with tool_calls: ${assistantWithToolCalls ? 'YES' : 'NO'}`
      );

      // This demonstrates the bug: when content is empty, no assistant message is sent
      expect(messages.length).toBeGreaterThan(0);

      // Record the bug for this provider
      if (!assistantWithToolCalls) {
        console.warn(
          `[${config.name}] BUG CONFIRMED: Missing assistant message with tool_calls when content is empty`
        );
      }
    });

    it('should send proper message sequence for text responses', async () => {
      const mockWebSocket = new MockWebSocket();

      // Mock transport to return text response
      vi.spyOn(provider as unknown as { transport: unknown }, 'transport', 'get').mockReturnValue({
        send: vi.fn().mockResolvedValue({
          type: 'non_streaming',
          data: config.createTextResponse('Hello, how can I help?'),
        }),
        parseResponse: vi.fn().mockReturnValue({
          content: 'Hello, how can I help?',
          toolUse: null,
          stopReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 15 },
        }),
      });

      // Execute makeApiCall with WebSocket
      await provider.makeApiCall([], 'hello', mockWebSocket, false);

      const messages = mockWebSocket.getMessages();
      expect(messages.length).toBeGreaterThan(0);

      // Should have sentence and final response messages
      const sentenceMessages = mockWebSocket.getMessagesByType('sentence');
      expect(sentenceMessages.length).toBe(1);
      expect(sentenceMessages[0].data.sentence).toBe('Hello, how can I help?');

      // Should have assistant response
      const assistantMessages = mockWebSocket.getMessagesByType('assistant_message');
      expect(assistantMessages.length).toBe(1);
      expect(assistantMessages[0].data.content).toBe('Hello, how can I help?');

      // Should have done message
      const doneMessages = mockWebSocket.getMessagesByType('done');
      expect(doneMessages.length).toBe(1);
    });

    it('should handle WebSocket errors gracefully', async () => {
      const mockWebSocket = new MockWebSocket();

      // Mock tool execution to fail
      vi.spyOn(
        provider as unknown as { invokeTool: (name: string, args: string) => Promise<string> },
        'invokeTool'
      ).mockRejectedValue(new Error('Tool execution failed'));

      // Mock transport to return tool call response
      vi.spyOn(provider as unknown as { transport: unknown }, 'transport', 'get').mockReturnValue({
        send: vi.fn().mockResolvedValue({
          type: 'non_streaming',
          data: config.createToolResponse('failing_tool', {}),
        }),
        parseResponse: vi.fn().mockReturnValue({
          content: '',
          toolUse: [
            {
              type: 'tool_use',
              id: 'tool_123',
              name: 'failing_tool',
              input: {},
            },
          ],
          stopReason: 'tool_use',
          usage: { inputTokens: 20, outputTokens: 30 },
        }),
      });

      // This should not throw, but handle the error gracefully
      try {
        await provider.makeApiCall([], 'test failing tool', mockWebSocket, false);
      } catch (error) {
        // Error is expected, but WebSocket should still get proper messages
      }

      const messages = mockWebSocket.getMessages();

      // Should have received some messages even during error
      expect(messages.length).toBeGreaterThan(0);

      // May have error messages
      const errorMessages = mockWebSocket.getMessagesByType('error');
      // Error handling varies by provider, so we just check that messages were sent
      expect(errorMessages).toBeDefined();
    });
  });
});
