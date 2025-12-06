import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from '../../src/shared/services/anthropic-provider.js';
import { AnthropicAPITransport } from '../../src/shared/transport/anthropic-api-transport.js';
import { SERVICE_PROVIDERS, Message, AgentConfig, ToolDefinition } from '@ailumina/shared';
import { MockWebSocket } from '../fixtures/websocket-mock.js';

// Mock the transport module
vi.mock('../../src/shared/transport/anthropic-api-transport.js', () => {
  return {
    AnthropicAPITransport: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
      processStreamingResponse: vi.fn(),
      parseResponse: vi.fn(),
      config: {
        model: 'claude-3-5-sonnet-20241022',
        timeout: 30000,
        apiKey: 'test-key',
      },
    })),
  };
});

describe('AnthropicProvider - Unit Tests', () => {
  let provider: AnthropicProvider;
  let mockWebSocket: MockWebSocket;
  let mockTransport: {
    send: ReturnType<typeof vi.fn>;
    processStreamingResponse: ReturnType<typeof vi.fn>;
    parseResponse: ReturnType<typeof vi.fn>;
    config: {
      model: string;
      timeout: number;
      apiKey: string;
    };
  };

  const testAgentConfig: AgentConfig = {
    agent_name: 'test-anthropic-agent',
    description: 'Test agent for unit testing',
    service_provider: 'ANTHROPIC' as const,
    model_name: 'claude-3-5-sonnet-20241022',
    system_prompt: 'You are a helpful assistant.',
    do_stream: false,
    available_functions: ['get_current_datetime', 'calculate'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocket = new MockWebSocket();
    provider = new AnthropicProvider(testAgentConfig);

    // Get the mocked transport instance
    mockTransport = (
      AnthropicAPITransport as unknown as {
        mock: { results: Array<{ value: typeof mockTransport }> };
      }
    ).mock.results[0].value;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.service_provider).toBe(SERVICE_PROVIDERS.ANTHROPIC);
      expect(provider.model_name).toBe('claude-3-5-sonnet-20241022');
      expect(provider.agent_name).toBe('test-anthropic-agent');
      // Cannot access protected property system_prompt directly, but it should be set internally
      expect((provider as unknown as { system_prompt?: string }).system_prompt).toBe(
        'You are a helpful assistant.'
      );
    });

    it('should create transport with correct configuration', () => {
      expect(AnthropicAPITransport).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        apiKey: expect.any(String),
        timeout: 30000,
      });
    });

    it('should handle missing agent_name gracefully', () => {
      const configWithoutName: AgentConfig = {
        ...testAgentConfig,
        agent_name: undefined as unknown as string,
      };

      const providerWithoutName = new AnthropicProvider(configWithoutName);
      expect(providerWithoutName.agent_name).toBeUndefined();
      expect(providerWithoutName.service_provider).toBe(SERVICE_PROVIDERS.ANTHROPIC);
    });
  });

  describe('Tool Registry Transformation', () => {
    beforeEach(() => {
      provider.tool_registry = {
        get_current_datetime: {
          name: 'get_current_datetime',
          description: 'Get the current date and time',
          enabled: true,
          parameters: {
            type: 'object',
            properties: {
              format: {
                type: 'string',
                enum: ['iso', 'human', 'timestamp'],
                default: 'iso',
              },
            },
            required: [],
          },
        } as ToolDefinition,
        calculate: {
          name: 'calculate',
          description: 'Perform a calculation',
          enabled: true,
          parameters: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate',
              },
            },
            required: ['expression'],
          },
        } as ToolDefinition,
      };
    });

    it('should transform tools to Anthropic format correctly', () => {
      const transformedTools = provider.transformToolRegistry();

      expect(transformedTools).toHaveLength(2);

      const datetimeTool = transformedTools.find(
        (t: unknown) => (t as { name: string }).name === 'get_current_datetime'
      ) as
        | { name: string; description: string; input_schema: { type: string; properties: unknown } }
        | undefined;
      expect(datetimeTool).toBeDefined();
      expect(datetimeTool?.description).toBe('Get the current date and time');
      expect(datetimeTool?.input_schema).toBeDefined();
      expect(datetimeTool?.input_schema.type).toBe('object');
      expect(datetimeTool?.input_schema.properties).toBeDefined();

      const calculateTool = transformedTools.find(
        (t: unknown) => (t as { name: string }).name === 'calculate'
      ) as { name: string; input_schema: { required: string[] } } | undefined;
      expect(calculateTool).toBeDefined();
      expect(calculateTool?.input_schema.required).toContain('expression');
    });

    it('should handle empty tool registry', () => {
      provider.tool_registry = {};
      const transformedTools = provider.transformToolRegistry();

      expect(transformedTools).toEqual([]);
    });
  });

  describe('Message Processing', () => {
    it('should process non-streaming messages correctly', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello! How can I help you today?',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      // Mock the transport.send to return a non-streaming result
      mockTransport.send.mockResolvedValue({
        type: 'non_streaming',
        data: mockResponse,
      });

      // Mock parseResponse to extract the right data
      mockTransport.parseResponse.mockReturnValue({
        content: 'Hello! How can I help you today?',
        toolUse: [],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
        stopReason: 'end_turn',
      });

      const messages: Message[] = [];
      const result = await provider.makeApiCall(messages, 'Hello', undefined, false);

      expect(mockTransport.send).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'Hello' })]),
        expect.objectContaining({
          systemPrompt: 'You are a helpful assistant.',
          stream: false,
        })
      );

      expect(result.response).toBeDefined();
      expect((result.response as { content: string }).content).toBe(
        'Hello! How can I help you today?'
      );
      expect(result.completeMessages).toHaveLength(2); // user + assistant
    });

    it('should handle streaming messages correctly', async () => {
      const mockStreamChunks = [
        { type: 'message_start', message: { id: 'msg_123', type: 'message', role: 'assistant' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' there!' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
        { type: 'message_stop' },
      ];

      // Mock the transport.send to return a streaming result
      mockTransport.send.mockResolvedValue({
        type: 'streaming',
        stream: (async function* () {
          for (const chunk of mockStreamChunks) {
            yield chunk;
          }
        })(),
      });

      // Mock processStreamingResponse
      mockTransport.processStreamingResponse.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello there!' }],
        stop_reason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 15 },
      });

      const messages: Message[] = [];
      const result = await provider.makeApiCall(messages, 'Hi', mockWebSocket, true);

      expect(mockTransport.send).toHaveBeenCalled();
      expect(mockTransport.processStreamingResponse).toHaveBeenCalled();
      expect((result.response as { content: string }).content).toBe('Hello there!');

      // Check WebSocket received streaming updates
      const wsMessages = mockWebSocket.getMessages();
      expect(wsMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Calling', () => {
    let mockInvokeTool: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      provider.tool_registry = {
        get_current_datetime: {
          name: 'get_current_datetime',
          description: 'Get current datetime',
          enabled: true,
          parameters: { type: 'object', properties: {}, required: [] },
        } as ToolDefinition,
      };

      // Mock the protected invokeTool method
      mockInvokeTool = vi
        .spyOn(
          provider as unknown as { invokeTool: (name: string, args: string) => Promise<string> },
          'invokeTool'
        )
        .mockResolvedValue('Current date and time: 2025-08-20T10:00:00Z');
    });

    it('should handle tool use responses correctly', async () => {
      const mockToolResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: "I'll check the time for you." },
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'get_current_datetime',
            input: {},
          },
        ],
        stop_reason: 'tool_use',
      };

      const mockFinalResponse = {
        id: 'msg_124',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'The current date and time is 2025-08-20T10:00:00Z.',
          },
        ],
        stop_reason: 'end_turn',
      };

      // First call returns tool use
      mockTransport.send.mockResolvedValueOnce({ type: 'non_streaming', data: mockToolResponse });
      mockTransport.parseResponse.mockReturnValueOnce({
        content: "I'll check the time for you.",
        toolUse: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'get_current_datetime',
            input: {},
          },
        ],
        usage: {},
        stopReason: 'tool_use',
      });

      // Second call returns final response
      mockTransport.send.mockResolvedValueOnce({ type: 'non_streaming', data: mockFinalResponse });
      mockTransport.parseResponse.mockReturnValueOnce({
        content: 'The current date and time is 2025-08-20T10:00:00Z.',
        toolUse: [],
        usage: {},
        stopReason: 'end_turn',
      });

      const messages: Message[] = [];
      const result = await provider.makeApiCall(messages, 'What time is it?', mockWebSocket, false);

      // Verify tool was invoked
      expect(mockInvokeTool).toHaveBeenCalledWith('get_current_datetime', '{}');

      // Verify final response
      expect((result.response as { content: string }).content).toContain('2025-08-20T10:00:00Z');

      // Verify WebSocket received tool execution updates
      const toolMessages = mockWebSocket.getMessagesByType('tool_message');
      expect(toolMessages.length).toBeGreaterThan(0);
    });

    it('should format tool response messages correctly', () => {
      const toolResult = provider.formatToolResponseMessage('Result: 42', 'calculate', 'tool_abc');

      expect(toolResult).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_abc',
            content: 'Result: 42',
          },
        ],
      });
    });

    it('should extract tool call info correctly', () => {
      const toolCall = {
        id: 'tool_xyz',
        name: 'calculate',
        input: { expression: '2 + 2' },
      };

      const extracted = provider.extractToolCallInfo(toolCall);

      expect(extracted).toEqual({
        id: 'tool_xyz',
        name: 'calculate',
        arguments: '{"expression":"2 + 2"}',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle transport errors gracefully', async () => {
      mockTransport.send.mockRejectedValue(new Error('Network error: Unable to reach API'));

      const messages: Message[] = [];
      await expect(
        provider.makeApiCall(messages, 'Test message', undefined, false)
      ).rejects.toThrow('Network error');
    });

    it('should handle invalid tool calls gracefully', async () => {
      // Mock invokeTool for this test
      const mockInvokeTool = vi
        .spyOn(
          provider as unknown as { invokeTool: (name: string, args: string) => Promise<string> },
          'invokeTool'
        )
        .mockRejectedValue(new Error('Tool not found: non_existent_tool'));

      const mockToolResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'non_existent_tool',
            input: {},
          },
        ],
        stop_reason: 'tool_use',
      };

      mockTransport.send.mockResolvedValueOnce({ type: 'non_streaming', data: mockToolResponse });
      mockTransport.parseResponse.mockReturnValueOnce({
        content: '',
        toolUse: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'non_existent_tool',
            input: {},
          },
        ],
        usage: {},
        stopReason: 'tool_use',
      });

      const mockErrorResponse = {
        id: 'msg_124',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I apologize, but I encountered an error with that tool.',
          },
        ],
        stop_reason: 'end_turn',
      };

      mockTransport.send.mockResolvedValueOnce({ type: 'non_streaming', data: mockErrorResponse });
      mockTransport.parseResponse.mockReturnValueOnce({
        content: 'I apologize, but I encountered an error with that tool.',
        toolUse: [],
        usage: {},
        stopReason: 'end_turn',
      });

      const messages: Message[] = [];
      const result = await provider.makeApiCall(
        messages,
        'Use a non-existent tool',
        mockWebSocket,
        false
      );

      expect(mockInvokeTool).toHaveBeenCalled();
      expect((result.response as { content: string }).content).toContain('error');
    });

    it('should handle malformed responses gracefully', async () => {
      mockTransport.send.mockResolvedValue({
        type: 'non_streaming',
        data: {
          // Missing required fields
          id: 'msg_123',
          // Missing: type, role, content
        },
      });

      mockTransport.parseResponse.mockReturnValue({
        content: null,
        toolUse: [],
        usage: {},
        stopReason: 'error',
      });

      const messages: Message[] = [];
      // The provider should handle this gracefully and return something
      const result = await provider.makeApiCall(messages, 'Test', undefined, false);

      // Should still return a result even with malformed response
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });

  describe('Message History Management', () => {
    it('should maintain conversation history correctly', async () => {
      const mockResponse1 = {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'First response' }],
        stop_reason: 'end_turn',
      };

      const mockResponse2 = {
        id: 'msg_2',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Second response' }],
        stop_reason: 'end_turn',
      };

      mockTransport.send.mockResolvedValueOnce({ type: 'non_streaming', data: mockResponse1 });
      mockTransport.parseResponse.mockReturnValueOnce({
        content: 'First response',
        toolUse: [],
        usage: {},
        stopReason: 'end_turn',
      });

      mockTransport.send.mockResolvedValueOnce({ type: 'non_streaming', data: mockResponse2 });
      mockTransport.parseResponse.mockReturnValueOnce({
        content: 'Second response',
        toolUse: [],
        usage: {},
        stopReason: 'end_turn',
      });

      const messages1: Message[] = [];
      const result1 = await provider.makeApiCall(messages1, 'First message', undefined, false);
      const result2 = await provider.makeApiCall(
        result1.completeMessages,
        'Second message',
        undefined,
        false
      );

      expect(result2.completeMessages).toHaveLength(4); // 2 user + 2 assistant
      expect(result2.completeMessages[0].content).toBe('First message');
      expect(result2.completeMessages[1].content).toBe('First response');
      expect(result2.completeMessages[2].content).toBe('Second message');
      expect(result2.completeMessages[3].content).toBe('Second response');
    });
  });

  describe('WebSocket Communication', () => {
    it('should send proper status messages via WebSocket', async () => {
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response text' }],
        stop_reason: 'end_turn',
      };

      mockTransport.send.mockResolvedValue({ type: 'non_streaming', data: mockResponse });
      mockTransport.parseResponse.mockReturnValue({
        content: 'Response text',
        toolUse: [],
        usage: {},
        stopReason: 'end_turn',
      });

      const messages: Message[] = [];
      await provider.makeApiCall(messages, 'Test', mockWebSocket, false);

      const wsMessages = mockWebSocket.getMessages();

      // Should have messages
      expect(wsMessages.length).toBeGreaterThan(0);

      // Check for done signal (should be present)
      const doneMessages = wsMessages.filter(
        (m) => typeof m.data === 'string' && JSON.parse(m.data).done === true
      );
      expect(doneMessages.length).toBeGreaterThan(0);
    });

    it('should handle WebSocket errors gracefully', async () => {
      // Create a WebSocket that throws on send
      const errorWebSocket = {
        send: vi.fn().mockImplementation(() => {
          throw new Error('WebSocket closed');
        }),
        readyState: 1, // OPEN
      };

      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
      };

      mockTransport.send.mockResolvedValue({ type: 'non_streaming', data: mockResponse });
      mockTransport.parseResponse.mockReturnValue({
        content: 'Response',
        toolUse: [],
        usage: {},
        stopReason: 'end_turn',
      });

      // Should not throw even if WebSocket fails
      const messages: Message[] = [];
      await expect(
        provider.makeApiCall(
          messages,
          'Test',
          errorWebSocket as { send: (data: string) => void },
          false
        )
      ).resolves.toBeDefined();
    });
  });
});
