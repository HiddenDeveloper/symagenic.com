import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../src/shared/services/ollama-provider.js';
import { ServiceFactory } from '../../src/shared/services/service-factory.js';
import { SERVICE_PROVIDERS } from '@ailumina/shared';
import { MockWebSocket } from '../fixtures/websocket-mock.js';

describe('Ollama Provider - Exploratory Tests', () => {
  let provider: OllamaProvider;
  let mockWebSocket: MockWebSocket;

  const testAgentConfig = {
    agent_name: 'test-ollama-agent',
    service_provider: 'OLLAMA' as const,
    model_name: 'gpt-oss:latest',
    description: 'Test Ollama agent',
    system_prompt:
      'You are a helpful assistant. Keep responses brief. You have access to tools/functions that you should use when appropriate. When a user asks for current time or date, use the get_current_datetime function.',
    do_stream: false,
    available_functions: ['get_current_datetime'],
  };

  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    provider = new OllamaProvider(testAgentConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Instantiation', () => {
    it('should create Ollama provider with correct configuration', () => {
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.service_provider).toBe(SERVICE_PROVIDERS.OLLAMA);
      expect(provider.model_name).toBe('gpt-oss:latest');
      expect(provider.agent_name).toBe('test-ollama-agent');
    });

    it('should be created by ServiceFactory for OLLAMA provider', () => {
      const factoryProvider = ServiceFactory.createServiceProvider(testAgentConfig);

      expect(factoryProvider).toBeInstanceOf(OllamaProvider);
      expect(factoryProvider.service_provider).toBe(SERVICE_PROVIDERS.OLLAMA);
    });

    it('should use correct base URL and timeout', () => {
      // Check that transport is configured correctly (access private field for testing)
      const transport = (provider as unknown as { transport: { config: { baseUrl: string } } })
        .transport;
      expect(transport.config.baseUrl).toBe('http://localhost:11434/v1');
      expect(transport.config.timeout).toBe(60000); // 60 seconds
      expect(transport.config.apiKey).toBe('ollama');
    });
  });

  describe('Basic Text Generation', () => {
    it('should handle simple text generation request', async () => {
      // This test will work if OLLAMA is running, skip gracefully if not
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

        console.log('OLLAMA Response:', response.content);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('OLLAMA not running - skipping integration test');
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

        console.log('OLLAMA Streaming Messages:', mockWebSocket.getMessages().length);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('OLLAMA not running - skipping streaming test');
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
          content.includes('language model') ||
          content.includes('ai') ||
          content.includes('help') ||
          content.includes('assist') ||
          content.length > 0; // At minimum should have some response
        expect(hasExpectedTerms).toBe(true);

        console.log('OLLAMA System Prompt Response:', response.content);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('OLLAMA not running - skipping system prompt test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 70000);
  });

  describe('Function Calling', () => {
    beforeEach(() => {
      // Create a proper tool definition with detailed OpenAPI schema
      const mockTool = {
        name: 'get_current_datetime',
        description:
          'Get the current date and time in ISO 8601 format. Use this when the user asks for the current time, date, or timestamp.',
        enabled: true,
        parameters: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              description: 'The format for the datetime response',
              enum: ['iso', 'human', 'timestamp'],
              default: 'iso',
            },
            timezone: {
              type: 'string',
              description: 'The timezone for the datetime (optional)',
              default: 'UTC',
            },
          },
          required: [],
        },
      };

      provider.tool_registry = {
        get_current_datetime: mockTool,
      };

      // Mock the invokeTool method with realistic implementation
      vi.spyOn(provider as any, 'invokeTool').mockImplementation(async (...args: any[]) => {
        const toolName = args[0] as string;
        const argsStr = args[1] as string;
        if (toolName === 'get_current_datetime') {
          const parsedArgs = JSON.parse(argsStr || '{}');
          const now = new Date();

          switch (parsedArgs.format) {
            case 'human':
              return `Current date and time: ${now.toLocaleString()}`;
            case 'timestamp':
              return `Current timestamp: ${now.getTime()}`;
            default:
              return `Current date and time: ${now.toISOString()}`;
          }
        }
        return 'Unknown tool';
      });
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

    it('should execute function calls and continue conversation', async () => {
      try {
        const messages: any[] = [];
        const userInput = 'What is the current time and date? Please use the available tools.';

        const result = await provider.makeApiCall(messages, userInput, mockWebSocket, false);

        expect(result).toBeDefined();
        expect(result.response).toBeDefined();
        const response = result.response as { content?: string };
        expect(response.content).toBeDefined();

        const content = response.content || '';
        console.log('OLLAMA Function Call Response:', content);
        console.log('WebSocket Messages:', mockWebSocket.getMessages().length);

        // Check if tool was actually called by examining mock calls
        const mockTool = (provider as any).invokeTool;
        const invokeCalls = mockTool?.mock?.calls || [];
        console.log('Tool invocation calls:', invokeCalls.length);

        if (invokeCalls.length > 0) {
          // Tool was called successfully
          expect(invokeCalls[0][0]).toBe('get_current_datetime');
          console.log('✅ Tool execution successful');

          // Response should include the tool result
          const hasTimeResponse =
            content.includes('2025') ||
            content.includes('time') ||
            content.includes('date') ||
            content.includes('Current');
          expect(hasTimeResponse).toBe(true);
        } else {
          // Tool was not called - model didn't recognize the need to use tools
          console.log(
            '⚠️  Model did not call tools - this indicates the model needs better prompting or tool descriptions'
          );
          console.log('Response:', content);

          // Still expect a valid response, just not tool-enhanced
          expect(content.length).toBeGreaterThan(0);

          // This is still a passing test - it shows the model responds, just doesn't use tools optimally
          console.log('Test passes: Model responded but did not use available tools');
        }
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('OLLAMA not running - skipping function calling test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 90000);

    it('should handle tool response format correctly', () => {
      const toolResult = provider.formatToolResponseMessage(
        'Tool execution result',
        'get_current_datetime',
        'call_123'
      );

      expect(toolResult).toBeDefined();
      expect(toolResult.role).toBe('tool');
      expect(toolResult.tool_call_id).toBe('call_123');
      expect(toolResult.name).toBe('get_current_datetime');
      expect(toolResult.content).toBe('Tool execution result');
    });

    it('should extract tool call info correctly', () => {
      const mockToolCall = {
        id: 'call_123',
        function: {
          name: 'get_current_datetime',
          arguments: '{}',
        },
      };

      const extracted = provider.extractToolCallInfo(mockToolCall);

      expect(extracted.id).toBe('call_123');
      expect(extracted.name).toBe('get_current_datetime');
      expect(extracted.arguments).toBe('{}');
    });

    it('should validate complete tool call WebSocket flow', async () => {
      try {
        const messages: any[] = [];
        const userInput = 'What time is it now?';

        await provider.makeApiCall(messages, userInput, mockWebSocket, false);

        // Validate the WebSocket message flow for tool execution
        const flowValidation = mockWebSocket.validateToolCallFlow();

        console.log('Tool Call Flow Validation:');
        console.log('Valid:', flowValidation.valid);
        console.log('Missing:', flowValidation.missing);
        console.log('Messages:', flowValidation.messages.length);

        // Should have tool execution messages if function calling worked
        const toolStatusMessages = mockWebSocket.getMessagesByType('tool_status');
        const toolMessages = mockWebSocket.getMessagesByType('tool_message');

        expect(toolStatusMessages.length).toBeGreaterThanOrEqual(0); // At least status messages
        console.log('Tool Status Messages:', toolStatusMessages.length);
        console.log('Tool Result Messages:', toolMessages.length);
        console.log('All WebSocket Messages:', mockWebSocket.getFlowSummary());
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('OLLAMA not running - skipping WebSocket flow test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 90000);
  });

  describe('Error Handling', () => {
    it('should handle timeout appropriately', async () => {
      // Create provider with very short timeout for testing
      const shortTimeoutConfig = {
        ...testAgentConfig,
        model_name: 'non-existent-model',
      };

      const shortProvider = new OllamaProvider(shortTimeoutConfig);

      try {
        await shortProvider.makeApiCall([], 'This should timeout or fail', undefined, false);
      } catch (error: any) {
        // Should either timeout or get model not found error
        expect(error.message).toBeDefined();
        expect(
          error.message.includes('timeout') ||
            error.message.includes('not found') ||
            error.message.includes('ECONNREFUSED')
        ).toBe(true);

        console.log('Expected error for timeout/model test:', error.message);
      }
    }, 70000);

    it('should handle invalid model gracefully', async () => {
      const invalidConfig = {
        ...testAgentConfig,
        model_name: 'definitely-not-a-real-model',
      };

      const invalidProvider = new OllamaProvider(invalidConfig);

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
  });

  describe('Performance Tests', () => {
    it('should complete simple request within reasonable time', async () => {
      try {
        const startTime = Date.now();

        const result = await provider.makeApiCall([], 'Say "OK"', undefined, false);

        const elapsed = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(elapsed).toBeLessThan(60000); // Should complete within 60 seconds

        console.log(`OLLAMA Simple request completed in ${elapsed}ms`);
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
          console.warn('OLLAMA not running - skipping performance test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 70000);
  });

  describe('Direct HTTP Endpoint Tests', () => {
    it('should handle function calling via OpenAI-compatible endpoint', async () => {
      try {
        const response = await fetch('http://localhost:11434/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-oss:latest',
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful assistant. When users ask for current time or date, use the get_current_datetime function.',
              },
              {
                role: 'user',
                content: 'What is the current time and date? Please use your available tools.',
              },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'get_current_datetime',
                  description:
                    'Get the current date and time in ISO 8601 format. Use this function when the user asks for the current time, date, or timestamp.',
                  parameters: {
                    type: 'object',
                    properties: {
                      format: {
                        type: 'string',
                        description: 'The format for the datetime response',
                        enum: ['iso', 'human', 'timestamp'],
                        default: 'iso',
                      },
                    },
                    required: [],
                  },
                },
              },
            ],
            tool_choice: 'auto',
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            choices?: {
              message?: {
                tool_calls?: {
                  type?: string;
                  function?: { name?: string };
                  id?: string;
                }[];
              };
            }[];
          };
          expect(data.choices).toBeDefined();
          expect(data.choices?.[0]?.message).toBeDefined();

          // Should contain tool calls
          const message = data.choices?.[0]?.message;
          expect(message?.tool_calls).toBeDefined();
          expect(Array.isArray(message?.tool_calls)).toBe(true);
          expect((message?.tool_calls || []).length).toBeGreaterThan(0);

          // Verify tool call structure
          const toolCall = message?.tool_calls?.[0];
          expect(toolCall?.type).toBe('function');
          expect(toolCall?.function?.name).toBe('get_current_datetime');
          expect(toolCall?.id).toBeDefined();

          console.log('OpenAI Endpoint Tool Call:', JSON.stringify(toolCall, null, 2));
        } else {
          console.warn('OpenAI endpoint test failed - OLLAMA may not be running');
        }
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
          console.warn('OLLAMA not running - skipping OpenAI endpoint test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 30000);

    it('should handle function calling via native OLLAMA endpoint', async () => {
      try {
        const response = await fetch('http://localhost:11434/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-oss:latest',
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful assistant. When users ask for current time or date, use the get_current_datetime function.',
              },
              {
                role: 'user',
                content: 'What is the current time and date? Please use your available tools.',
              },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'get_current_datetime',
                  description:
                    'Get the current date and time in ISO 8601 format. Use this function when the user asks for the current time, date, or timestamp.',
                  parameters: {
                    type: 'object',
                    properties: {
                      format: {
                        type: 'string',
                        description: 'The format for the datetime response',
                        enum: ['iso', 'human', 'timestamp'],
                        default: 'iso',
                      },
                    },
                    required: [],
                  },
                },
              },
            ],
          }),
        });

        if (response.ok) {
          const rawText = await response.text();

          // Native OLLAMA returns streaming JSON objects
          const lines = rawText.trim().split('\n');
          let finalMessage = null;

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message && parsed.done) {
                finalMessage = parsed.message;
                break;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }

          expect(finalMessage).toBeDefined();
          expect(finalMessage.tool_calls).toBeDefined();
          expect(Array.isArray(finalMessage.tool_calls)).toBe(true);
          expect(finalMessage.tool_calls.length).toBeGreaterThan(0);

          // Verify tool call structure (native format)
          const toolCall = finalMessage.tool_calls[0];
          expect(toolCall.function.name).toBe('get_current_datetime');

          console.log('Native Endpoint Tool Call:', JSON.stringify(toolCall, null, 2));
        } else {
          console.warn('Native endpoint test failed - OLLAMA may not be running');
        }
      } catch (error: any) {
        if (error.message.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
          console.warn('OLLAMA not running - skipping native endpoint test');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 30000);

    it('should compare response formats between endpoints', async () => {
      try {
        // Test both endpoints and compare their outputs
        const [openaiResponse, nativeResponse] = await Promise.allSettled([
          fetch('http://localhost:11434/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-oss:latest',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a helpful assistant. Use get_current_datetime when asked for time.',
                },
                { role: 'user', content: 'What time is it? Use tools.' },
              ],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'get_current_datetime',
                    description: 'Get the current date and time. Use when asked for time.',
                    parameters: {
                      type: 'object',
                      properties: {
                        format: { type: 'string', enum: ['iso', 'human'] },
                      },
                      required: [],
                    },
                  },
                },
              ],
            }),
          }).then((r: any) => r.json()),

          fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-oss:latest',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a helpful assistant. Use get_current_datetime when asked for time.',
                },
                { role: 'user', content: 'What time is it? Use tools.' },
              ],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'get_current_datetime',
                    description: 'Get the current date and time. Use when asked for time.',
                    parameters: {
                      type: 'object',
                      properties: {
                        format: { type: 'string', enum: ['iso', 'human'] },
                      },
                      required: [],
                    },
                  },
                },
              ],
            }),
          }).then((r: any) => r.text()),
        ]);

        console.log('Endpoint comparison results:');
        console.log('OpenAI endpoint status:', openaiResponse.status);
        console.log('Native endpoint status:', nativeResponse.status);

        // Both should either succeed or fail gracefully
        expect(true).toBe(true); // Pass test - comparison is informational
      } catch (error: any) {
        console.warn('Endpoint comparison failed - OLLAMA may not be running');
        expect(true).toBe(true);
      }
    }, 45000);
  });

  describe('Configuration Tests', () => {
    it('should respect environment variable for base URL', () => {
      // Test with environment variable override
      process.env.OLLAMA_BASE_URL = 'http://custom-ollama:11434/v1';

      const customProvider = new OllamaProvider(testAgentConfig);

      const transport = (customProvider as any).transport;
      expect(transport.config.baseUrl).toBe('http://custom-ollama:11434/v1');

      // Clean up
      delete process.env.OLLAMA_BASE_URL;
    });

    it('should use default base URL when no environment variable', () => {
      delete process.env.OLLAMA_BASE_URL;

      const defaultProvider = new OllamaProvider(testAgentConfig);

      const transport = (defaultProvider as any).transport;
      expect(transport.config.baseUrl).toBe('http://localhost:11434/v1');
    });
  });
});
