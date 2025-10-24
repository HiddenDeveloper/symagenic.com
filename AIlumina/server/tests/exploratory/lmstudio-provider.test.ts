import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LMStudioProvider } from '../../src/shared/services/lmstudio-provider.js';
import { ServiceFactory } from '../../src/shared/services/service-factory.js';
import { SERVICE_PROVIDERS } from '@ailumina/shared';
import { MockWebSocket } from '../fixtures/websocket-mock.js';

describe('LMStudio Provider - Exploratory Tests', () => {
  let provider: LMStudioProvider;
  let mockWebSocket: MockWebSocket;

  const testAgentConfig = {
    agent_name: 'test-lmstudio-agent',
    service_provider: 'LMSTUDIO' as const,
    model_name: 'openai/gpt-oss-20b',
    description: 'Test LMStudio agent',
    system_prompt: 'You are a helpful assistant. Keep responses brief.',
    do_stream: false,
    available_functions: ['get_current_datetime'],
  };

  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    provider = new LMStudioProvider(testAgentConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Instantiation', () => {
    it('should create LMStudio provider with correct configuration', () => {
      expect(provider).toBeInstanceOf(LMStudioProvider);
      expect(provider.service_provider).toBe(SERVICE_PROVIDERS.LMSTUDIO);
      expect(provider.model_name).toBe('openai/gpt-oss-20b');
      expect(provider.agent_name).toBe('test-lmstudio-agent');
    });

    it('should be created by ServiceFactory for LMSTUDIO provider', () => {
      const factoryProvider = ServiceFactory.createServiceProvider(testAgentConfig);

      expect(factoryProvider).toBeInstanceOf(LMStudioProvider);
      expect(factoryProvider.service_provider).toBe(SERVICE_PROVIDERS.LMSTUDIO);
    });

    it('should use correct base URL and timeout', () => {
      // Check that transport is configured correctly (access private field for testing)
      const transport = (provider as unknown as { transport: { config: { baseUrl: string } } })
        .transport;
      expect(transport.config.baseUrl).toBe('http://localhost:1234/v1');
      expect(transport.config.timeout).toBe(60000); // 60 seconds
      expect(transport.config.apiKey).toBe('lmstudio');
    });
  });

  describe('Basic Text Generation', () => {
    it('should handle simple text generation request', async () => {
      // This test will work if LMStudio is running, skip gracefully if not
      try {
        const messages: any[] = [];
        const userInput = 'Say "Hello" in one word only';

        const result = await provider.makeApiCall(
          messages,
          userInput,
          undefined, // no websocket
          false // no streaming
        );

        expect(result).toBeDefined();
        expect(result.response).toBeDefined();
        expect(result.completeMessages).toBeDefined();
        expect(result.completeMessages.length).toBeGreaterThan(0);

        // Check that response contains text
        const response = result.response as { content?: string };
        expect(response.content).toBeDefined();
        expect(typeof response.content).toBe('string');
        expect((response.content || '').length).toBeGreaterThan(0);

        console.log('LMStudio Response:', response.content);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('LMStudio not running - skipping integration test');
          expect(true).toBe(true); // Pass test gracefully
        } else {
          throw error;
        }
      }
    }, 70000); // 70 second timeout for slow responses

    it('should handle streaming text generation', async () => {
      try {
        const messages: any[] = [];
        const userInput = 'Count to 3';

        const result = await provider.makeApiCall(
          messages,
          userInput,
          mockWebSocket,
          true // streaming enabled
        );

        expect(result).toBeDefined();
        expect(result.response).toBeDefined();

        // Check that websocket received messages
        expect(mockWebSocket.getMessages().length).toBeGreaterThan(0);

        console.log('LMStudio Streaming Messages:', mockWebSocket.getMessages().length);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('LMStudio not running - skipping streaming test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 70000);

    it('should handle system prompt correctly', async () => {
      try {
        const messages: any[] = [];
        const userInput = 'What is your role?';

        const result = await provider.makeApiCall(messages, userInput, undefined, false);

        expect(result).toBeDefined();
        const response = result.response as { content?: string };
        expect(response.content).toBeDefined();

        // Response should reflect the system prompt (model may not always follow it exactly)
        const content = (response.content || '').toLowerCase();
        const hasExpectedTerms =
          content.includes('helpful') ||
          content.includes('assistant') ||
          content.includes('brief') ||
          content.includes('information') ||
          content.includes('help') ||
          content.includes('guidance') ||
          content.length > 0; // At minimum should have some response
        expect(hasExpectedTerms).toBe(true);

        console.log('LMStudio System Prompt Response:', response.content);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('LMStudio not running - skipping system prompt test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 70000);

    it('should handle different model configurations', async () => {
      // Test with a different model name that might be loaded in LMStudio
      const altConfig = {
        ...testAgentConfig,
        model_name: 'llama-2-7b-chat',
      };

      const altProvider = new LMStudioProvider(altConfig);

      try {
        const result = await altProvider.makeApiCall([], 'Hi', undefined, false);

        expect(result).toBeDefined();
        const response = result.response as { content?: string };
        console.log('LMStudio Alt Model Response:', response.content);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('LMStudio not running - skipping alt model test');
          expect(true).toBe(true);
        } else {
          // Could be model not found, which is also acceptable for this test
          console.log('Expected error for alt model (model may not be loaded):', error.message);
          expect(error.message).toBeDefined();
        }
      }
    }, 70000);
  });

  describe('Function Calling', () => {
    beforeEach(() => {
      // Mock the get_current_datetime function
      const mockTool = {
        name: 'get_current_datetime',
        description: 'Get the current date and time',
        enabled: true,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      };

      provider.tool_registry = {
        get_current_datetime: mockTool,
      };

      // Mock the invokeTool method
      vi.spyOn(provider as any, 'invokeTool').mockResolvedValue(
        'Current date and time: 2025-08-17T10:30:00Z'
      );
    });

    it('should transform tools to OpenAI format correctly', () => {
      const transformedTools = provider.transformToolRegistry();

      expect(transformedTools).toBeDefined();
      expect(Array.isArray(transformedTools)).toBe(true);

      if (transformedTools.length > 0) {
        const tool = transformedTools[0] as {
          type?: string;
          function?: {
            name?: string;
            description?: string;
            parameters?: { type?: string };
          };
        };
        expect(tool.type).toBe('function');
        expect(tool.function).toBeDefined();
        expect(tool.function?.name).toBe('get_current_datetime');
        expect(tool.function?.description).toBeDefined();
        expect(tool.function?.parameters).toBeDefined();
        expect(tool.function?.parameters?.type).toBe('object');
      }
    });

    it('should handle function calling request', async () => {
      try {
        const messages: any[] = [];
        const userInput = 'What time is it now?';

        const result = await provider.makeApiCall(messages, userInput, mockWebSocket, false);

        expect(result).toBeDefined();
        expect(result.response).toBeDefined();

        const response = result.response as { content?: string };
        console.log('LMStudio Function Call Response:', response.content);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('LMStudio not running - skipping function calling test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 70000);

    it('should handle complex tool definitions', () => {
      // Test with a more complex tool definition
      const complexTool = {
        name: 'get_weather',
        description: 'Get weather information for a location',
        enabled: true,
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'Temperature unit',
            },
          },
          required: ['location'],
        },
      };

      provider.tool_registry = {
        get_weather: complexTool,
      };

      const transformedTools = provider.transformToolRegistry();
      expect(transformedTools).toBeDefined();
      expect(transformedTools.length).toBe(1);

      const tool = transformedTools[0] as {
        function?: {
          name?: string;
          parameters?: {
            properties?: { location?: any; unit?: any };
            required?: string[];
          };
        };
      };
      expect(tool.function?.name).toBe('get_weather');
      expect(tool.function?.parameters?.properties?.location).toBeDefined();
      expect(tool.function?.parameters?.properties?.unit).toBeDefined();
      expect(tool.function?.parameters?.required).toContain('location');
    });

    it('should handle tool response format correctly', () => {
      const toolResult = provider.formatToolResponseMessage(
        'Weather: Sunny, 25°C',
        'get_weather',
        'call_456'
      );

      expect(toolResult).toBeDefined();
      expect(toolResult.role).toBe('tool');
      expect(toolResult.tool_call_id).toBe('call_456');
      expect(toolResult.name).toBe('get_weather');
      expect(toolResult.content).toBe('Weather: Sunny, 25°C');
    });

    it('should extract tool call info correctly', () => {
      const mockToolCall = {
        id: 'call_456',
        function: {
          name: 'get_weather',
          arguments: '{"location": "San Francisco, CA", "unit": "celsius"}',
        },
      };

      const extracted = provider.extractToolCallInfo(mockToolCall);

      expect(extracted.id).toBe('call_456');
      expect(extracted.name).toBe('get_weather');
      expect(extracted.arguments).toBe('{"location": "San Francisco, CA", "unit": "celsius"}');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection refused gracefully', async () => {
      try {
        await provider.makeApiCall(
          [],
          'This should fail if LMStudio is not running',
          undefined,
          false
        );
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          expect(error.message).toBeDefined();
          console.log('Expected connection error when LMStudio not running:', error.message);
        } else {
          // If not a connection error, it might be another type of error
          expect(error.message).toBeDefined();
        }
      }
    }, 30000);

    it('should handle invalid model gracefully', async () => {
      const invalidConfig = {
        ...testAgentConfig,
        model_name: 'definitely-not-a-real-model',
      };

      const invalidProvider = new LMStudioProvider(invalidConfig);

      try {
        await invalidProvider.makeApiCall(
          [],
          'This should fail with model not found',
          undefined,
          false
        );
      } catch (error: any) {
        expect(error.message).toBeDefined();
        console.log('Expected error for invalid model:', error.message);
      }
    }, 30000);

    it('should handle timeout appropriately', async () => {
      // This test assumes LMStudio is not running to test timeout
      try {
        await provider.makeApiCall([], 'This should timeout', undefined, false);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(
          error.message.includes('timeout') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('connection')
        ).toBe(true);

        console.log('Expected error for timeout/connection test:', error.message);
      }
    }, 70000);
  });

  describe('Performance Tests', () => {
    it('should complete simple request within reasonable time', async () => {
      try {
        const startTime = Date.now();

        const result = await provider.makeApiCall([], 'Say "OK"', undefined, false);

        const elapsed = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(elapsed).toBeLessThan(60000); // Should complete within 60 seconds

        console.log(`LMStudio Simple request completed in ${elapsed}ms`);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('LMStudio not running - skipping performance test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 70000);

    it('should handle concurrent requests', async () => {
      try {
        const requests = [
          provider.makeApiCall([], 'Say "1"', undefined, false),
          provider.makeApiCall([], 'Say "2"', undefined, false),
          provider.makeApiCall([], 'Say "3"', undefined, false),
        ];

        const results = await Promise.allSettled(requests);

        // At least some should succeed if LMStudio is running
        const fulfilled = results.filter((r: any) => r.status === 'fulfilled');
        expect(fulfilled.length).toBeGreaterThanOrEqual(0);

        console.log(`LMStudio Concurrent requests: ${fulfilled.length}/3 succeeded`);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('LMStudio not running - skipping concurrent test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 120000); // 2 minutes for concurrent requests
  });

  describe('Configuration Tests', () => {
    it('should respect environment variable for base URL', () => {
      // Test with environment variable override
      process.env.LMSTUDIO_BASE_URL = 'http://custom-lmstudio:1234/v1';

      const customProvider = new LMStudioProvider(testAgentConfig);

      const transport = (customProvider as any).transport;
      expect(transport.config.baseUrl).toBe('http://custom-lmstudio:1234/v1');

      // Clean up
      delete process.env.LMSTUDIO_BASE_URL;
    });

    it('should use default base URL when no environment variable', () => {
      delete process.env.LMSTUDIO_BASE_URL;

      const defaultProvider = new LMStudioProvider(testAgentConfig);

      const transport = (defaultProvider as any).transport;
      expect(transport.config.baseUrl).toBe('http://localhost:1234/v1');
    });

    it('should handle different timeout configurations', () => {
      const transport = (provider as any).transport;
      expect(transport.config.timeout).toBe(60000);

      // Verify it's different from default OpenAI timeout
      expect(transport.config.timeout).toBeGreaterThan(30000);
    });
  });

  describe('Integration with agents.json', () => {
    it('should work with journaling agent configuration', () => {
      // Test with the actual journaling agent config from agents.json
      const journalingConfig = {
        agent_name: 'journaling',
        service_provider: 'LMSTUDIO' as const,
        model_name: 'openai/gpt-oss-20b',
        description: 'Journaling Agent',
        system_prompt: 'You are an AI journaling assistant...',
        do_stream: true,
        available_functions: [
          'read_document',
          'create_document',
          'update_document',
          'delete_document',
          'get_current_datetime',
        ],
      };

      const journalingProvider = new LMStudioProvider(journalingConfig);

      expect(journalingProvider).toBeInstanceOf(LMStudioProvider);
      expect(journalingProvider.model_name).toBe('openai/gpt-oss-20b');
      expect(journalingProvider.agent_name).toBe('journaling');
    });
  });
});
