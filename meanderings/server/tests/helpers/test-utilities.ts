/**
 * Test Helper Utilities
 *
 * Common utility functions for testing providers, transports, and message shapes
 */

import { vi, MockedFunction } from 'vitest';
import { Message, AgentConfig, ToolDefinition } from '@ailumina/shared';
import type {
  TransportResult,
  StreamingTransportResult,
  NonStreamingTransportResult,
} from '../../src/shared/types/transport-types.js';

/**
 * Creates a mock transport for testing providers
 */
export function createMockTransport(config?: {
  model?: string;
  timeout?: number;
  apiKey?: string;
  baseUrl?: string;
}) {
  return {
    send: vi.fn() as MockedFunction<
      (messages: Message[], options: unknown) => Promise<TransportResult>
    >,
    processStreamingResponse: vi.fn() as MockedFunction<
      (stream: AsyncGenerator) => Promise<unknown>
    >,
    parseResponse: vi.fn() as MockedFunction<(response: unknown) => unknown>,
    config: {
      model: config?.model || 'test-model',
      timeout: config?.timeout || 30000,
      apiKey: config?.apiKey || 'test-key',
      baseUrl: config?.baseUrl,
    },
  };
}

/**
 * Creates a mock tool registry for testing
 */
export function createMockToolRegistry(tools: Record<string, Partial<ToolDefinition>>) {
  const registry: Record<string, ToolDefinition> = {};

  for (const [name, tool] of Object.entries(tools)) {
    registry[name] = {
      name,
      description: tool.description || `Description for ${name}`,
      enabled: tool.enabled !== undefined ? tool.enabled : true,
      parameters: tool.parameters || {
        type: 'object',
        properties: {},
        required: [],
      },
    };
  }

  return registry;
}

/**
 * Creates a mock WebSocket response for testing streaming
 */
export function createMockStreamingResponse(chunks: unknown[]): StreamingTransportResult {
  return {
    type: 'streaming',
    stream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
  };
}

/**
 * Creates a mock non-streaming response
 */
export function createMockNonStreamingResponse(data: unknown): NonStreamingTransportResult {
  return {
    type: 'non_streaming',
    data,
  };
}

/**
 * Helper to assert message format compatibility
 */
export function assertMessageFormat(
  message: unknown,
  provider: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' | 'lmstudio'
): void {
  const msg = message as Record<string, unknown>;

  switch (provider) {
    case 'openai':
    case 'groq':
    case 'ollama':
    case 'lmstudio':
      if (!msg.role || (typeof msg.content !== 'string' && !msg.tool_calls)) {
        throw new Error(`Invalid ${provider} message format`);
      }
      break;

    case 'anthropic':
      if (!msg.role || !Array.isArray(msg.content)) {
        throw new Error('Invalid Anthropic message format');
      }
      break;

    case 'gemini':
      if (!msg.role || (typeof msg.content !== 'string' && !msg.parts)) {
        throw new Error('Invalid Gemini message format');
      }
      break;
  }
}

/**
 * Helper to create a valid agent config for testing
 */
export function createTestAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    agent_name: overrides?.agent_name || 'test-agent',
    description: overrides?.description || 'Test agent for unit testing',
    service_provider: overrides?.service_provider || 'OPENAI',
    model_name: overrides?.model_name || 'gpt-4',
    system_prompt: overrides?.system_prompt || 'You are a helpful assistant.',
    do_stream: overrides?.do_stream || false,
    available_functions: overrides?.available_functions || [],
    ...overrides,
  } as AgentConfig;
}

/**
 * Helper to wait for async operations in tests
 */
export async function waitForAsync(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to capture console output during tests
 */
export function captureConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  const captured = {
    logs: [] as unknown[],
    errors: [] as unknown[],
    warnings: [] as unknown[],
  };

  console.log = (...args: unknown[]) => captured.logs.push(args);
  console.error = (...args: unknown[]) => captured.errors.push(args);
  console.warn = (...args: unknown[]) => captured.warnings.push(args);

  return {
    captured,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
  };
}

/**
 * Helper to mock environment variables for testing
 */
export function mockEnvironment(vars: Record<string, string>) {
  const original = { ...process.env };

  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value;
  }

  return {
    restore: () => {
      for (const key of Object.keys(vars)) {
        if (original[key] !== undefined) {
          process.env[key] = original[key];
        } else {
          delete process.env[key];
        }
      }
    },
  };
}

/**
 * Helper to create mock API responses for different providers
 */
export function createMockApiResponse(
  provider: string,
  type: 'text' | 'tool' | 'error',
  content?: string
): unknown {
  switch (provider) {
    case 'openai':
    case 'groq':
    case 'ollama':
    case 'lmstudio':
      if (type === 'error') {
        return {
          error: {
            message: content || 'API Error',
            type: 'api_error',
            code: 'error_code',
          },
        };
      }
      return {
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: type === 'text' ? content || 'Test response' : null,
              tool_calls:
                type === 'tool'
                  ? [
                      {
                        id: 'call_test',
                        type: 'function',
                        function: {
                          name: 'test_tool',
                          arguments: '{}',
                        },
                      },
                    ]
                  : undefined,
            },
            finish_reason: type === 'tool' ? 'tool_calls' : 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

    case 'anthropic':
      if (type === 'error') {
        return {
          type: 'error',
          error: {
            type: 'api_error',
            message: content || 'API Error',
          },
        };
      }
      return {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-3',
        content:
          type === 'text'
            ? [{ type: 'text', text: content || 'Test response' }]
            : [
                { type: 'text', text: 'Using tool' },
                { type: 'tool_use', id: 'tool_test', name: 'test_tool', input: {} },
              ],
        stop_reason: type === 'tool' ? 'tool_use' : 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      };

    case 'gemini':
      if (type === 'error') {
        return {
          error: {
            code: 400,
            message: content || 'API Error',
            status: 'INVALID_ARGUMENT',
          },
        };
      }
      return {
        candidates: [
          {
            content: {
              parts:
                type === 'text'
                  ? [{ text: content || 'Test response' }]
                  : [{ text: 'Using function' }, { functionCall: { name: 'test_tool', args: {} } }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      };

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Helper to validate tool call extraction
 */
export function validateToolCallExtraction(
  provider: string,
  message: unknown,
  expectedToolName: string
): boolean {
  const msg = message as Record<string, unknown>;

  switch (provider) {
    case 'openai':
    case 'groq':
    case 'ollama':
    case 'lmstudio': {
      const toolCalls = msg.tool_calls as Array<{ function: { name: string } }>;
      return toolCalls?.some((call) => call.function.name === expectedToolName) || false;
    }

    case 'anthropic': {
      const content = msg.content as Array<{ type: string; name?: string }>;
      return (
        content?.some((block) => block.type === 'tool_use' && block.name === expectedToolName) ||
        false
      );
    }

    case 'gemini': {
      const parts = msg.parts as Array<{ functionCall?: { name: string } }>;
      return parts?.some((part) => part.functionCall?.name === expectedToolName) || false;
    }

    default:
      return false;
  }
}

/**
 * Helper for asserting async errors
 */
export async function expectAsyncError(
  fn: () => Promise<unknown>,
  errorMessage?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (errorMessage) {
      const message = (error as Error).message;
      if (typeof errorMessage === 'string') {
        if (!message.includes(errorMessage)) {
          throw new Error(`Expected error message to include "${errorMessage}", got "${message}"`);
        }
      } else {
        if (!errorMessage.test(message)) {
          throw new Error(`Expected error message to match ${errorMessage}, got "${message}"`);
        }
      }
    }
  }
}
