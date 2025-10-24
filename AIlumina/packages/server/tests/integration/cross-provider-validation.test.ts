import { describe, it, expect, vi, beforeEach } from 'vitest';

// Type definitions for test mocks
interface MockToolEntry {
  definition: {
    enabled: boolean;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface MockTransport {
  parseResponse: () => {
    content: string | null;
    stopReason?: string;
    finishReason?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens?: number;
    } | null;
    toolUse?: unknown[];
    toolCalls?: unknown[];
    functionCalls?: unknown[];
  };
}

type FormatFunction = (
  name: string,
  definition: { enabled: boolean; description: string; parameters: Record<string, unknown> }
) => unknown;

interface ProviderWithTransport {
  transport: MockTransport;
  transformToolsBase: (formatFunction: FormatFunction) => unknown[];
  ensureSystemPrompt: () => void;
}

// Tool structure types for different providers
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    required: string[];
  };
}

interface OpenAITool {
  function: {
    name: string;
    description: string;
    parameters: {
      required: string[];
    };
  };
}

interface GoogleTool {
  name: string;
  description: string;
  parameters: {
    required: string[];
  };
}
import { AnthropicProvider } from '../../src/shared/services/anthropic-provider.js';
import { OpenAIProvider } from '../../src/shared/services/openai-provider.js';
import { GoogleProvider } from '../../src/shared/services/google-provider.js';
import { SERVICE_PROVIDERS } from '@ailumina/shared';
import {
  SAMPLE_TOOLS,
  SAMPLE_FUNCTION_CALLS,
  SAMPLE_FUNCTION_RESULTS,
} from '../fixtures/provider-mocks.js';

describe('Cross-Provider Validation', () => {
  let anthropicProvider: AnthropicProvider;
  let openaiProvider: OpenAIProvider;
  let googleProvider: GoogleProvider;

  const mockAgentConfig = {
    agent_name: 'test-agent',
    service_provider: SERVICE_PROVIDERS.OPENAI,
    model_name: 'test-model',
    description: 'Test agent configuration for cross-provider validation',
    system_prompt: 'You are a helpful assistant.',
    do_stream: false,
  };

  beforeEach(() => {
    anthropicProvider = new AnthropicProvider(mockAgentConfig);

    openaiProvider = new OpenAIProvider(mockAgentConfig);

    googleProvider = new GoogleProvider(mockAgentConfig);
  });

  describe('Consistent Response Structure', () => {
    it('should return consistent response structure across all providers', () => {
      // Mock transport responses for consistent testing
      const mockAnthropicTransport = {
        parseResponse: () => ({
          content: 'Test response',
          stopReason: 'end_turn',
          usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
        }),
      };

      const mockOpenAITransport = {
        parseResponse: () => ({
          content: 'Test response',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
        }),
      };

      const mockGoogleTransport = {
        parseResponse: () => ({
          content: 'Test response',
          finishReason: 'STOP',
          usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
        }),
      };

      vi.spyOn(anthropicProvider as any, 'transport', 'get').mockReturnValue(
        mockAnthropicTransport
      );
      vi.spyOn(openaiProvider as any, 'transport', 'get').mockReturnValue(mockOpenAITransport);
      vi.spyOn(googleProvider as any, 'transport', 'get').mockReturnValue(mockGoogleTransport);

      const anthropicParts = anthropicProvider.extractPartsFromResponse({});
      const openaiParts = openaiProvider.extractPartsFromResponse({});
      const googleParts = googleProvider.extractPartsFromResponse({});

      // All providers should return the same interface structure
      const expectedKeys = ['fullMessage', 'usageInfo', 'toolUse', 'text', 'stopReason'];

      expectedKeys.forEach((key) => {
        expect(anthropicParts).toHaveProperty(key);
        expect(openaiParts).toHaveProperty(key);
        expect(googleParts).toHaveProperty(key);
      });

      // Text content should be consistent
      expect(anthropicParts.text).toBe('Test response');
      expect(openaiParts.text).toBe('Test response');
      expect(googleParts.text).toBe('Test response');
    });

    it('should handle tool calls consistently across providers', () => {
      const mockAnthropicTransport = {
        parseResponse: () => ({
          content: 'Using tool',
          stopReason: 'tool_use',
          toolUse: [
            {
              type: 'tool_use',
              id: 'tool_123',
              name: 'get_weather',
              input: SAMPLE_FUNCTION_CALLS.weather,
            },
          ],
          usage: { inputTokens: 20, outputTokens: 30 },
        }),
      };

      const mockOpenAITransport = {
        parseResponse: () => ({
          content: 'Using tool',
          finishReason: 'tool_calls',
          toolCalls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: JSON.stringify(SAMPLE_FUNCTION_CALLS.weather),
              },
            },
          ],
          usage: { inputTokens: 20, outputTokens: 30 },
        }),
      };

      const mockGoogleTransport = {
        parseResponse: () => ({
          content: 'Using tool',
          finishReason: 'STOP',
          functionCalls: [
            {
              name: 'get_weather',
              args: SAMPLE_FUNCTION_CALLS.weather,
            },
          ],
          usage: { inputTokens: 20, outputTokens: 30 },
        }),
      };

      vi.spyOn(anthropicProvider as any, 'transport', 'get').mockReturnValue(
        mockAnthropicTransport
      );
      vi.spyOn(openaiProvider as any, 'transport', 'get').mockReturnValue(mockOpenAITransport);
      vi.spyOn(googleProvider as any, 'transport', 'get').mockReturnValue(mockGoogleTransport);

      const anthropicParts = anthropicProvider.extractPartsFromResponse({});
      const openaiParts = openaiProvider.extractPartsFromResponse({});
      const googleParts = googleProvider.extractPartsFromResponse({});

      // All should have tool use detected
      expect(anthropicParts.toolUse).not.toBeNull();
      expect(openaiParts.toolUse).not.toBeNull();
      expect(googleParts.toolUse).not.toBeNull();

      // All should extract tool information
      const anthropicToolInfo = anthropicProvider.extractToolCallInfo(
        anthropicParts.toolUse as any
      );
      const openaiToolInfo = openaiProvider.extractToolCallInfo(openaiParts.toolUse as any);
      const googleToolInfo = googleProvider.extractToolCallInfo(googleParts.toolUse as any);

      // Tool names should be consistent
      expect(anthropicToolInfo.name).toBe('get_weather');
      expect(openaiToolInfo.name).toBe('get_weather');
      expect(googleToolInfo.name).toBe('get_weather');

      // Arguments should parse to same object
      expect(JSON.parse(anthropicToolInfo.arguments)).toEqual(SAMPLE_FUNCTION_CALLS.weather);
      expect(JSON.parse(openaiToolInfo.arguments)).toEqual(SAMPLE_FUNCTION_CALLS.weather);
      expect(JSON.parse(googleToolInfo.arguments)).toEqual(SAMPLE_FUNCTION_CALLS.weather);
    });
  });

  describe('Tool Registry Consistency', () => {
    it('should transform tools consistently with provider-specific formats', () => {
      // Mock the transformToolsBase method for all providers
      const mockToolRegistry = new Map<string, MockToolEntry>();
      mockToolRegistry.set('get_weather', {
        definition: {
          enabled: true,
          description: SAMPLE_TOOLS.weather.description,
          parameters: SAMPLE_TOOLS.weather.parameters,
        },
      });

      const mockTransformBase = (formatFunction: FormatFunction): unknown[] => {
        const results: unknown[] = [];
        for (const [name, toolEntry] of Array.from(mockToolRegistry.entries())) {
          if (toolEntry.definition.enabled) {
            const result = formatFunction(name, toolEntry.definition as any);
            if (result !== null) {
              results.push(result);
            }
          }
        }
        return results;
      };

      vi.spyOn(anthropicProvider as any, 'transformToolsBase').mockImplementation(
        mockTransformBase as any
      );
      vi.spyOn(openaiProvider as any, 'transformToolsBase').mockImplementation(
        mockTransformBase as any
      );
      vi.spyOn(googleProvider as any, 'transformToolsBase').mockImplementation(
        mockTransformBase as any
      );

      const anthropicTools = anthropicProvider.transformToolRegistry();
      const openaiTools = openaiProvider.transformToolRegistry();
      const googleTools = googleProvider.transformToolRegistry();

      // All should return one tool
      expect(anthropicTools).toHaveLength(1);
      expect(openaiTools).toHaveLength(1);
      expect(googleTools).toHaveLength(1);

      // All should have the same tool name and description
      const anthropicTool = anthropicTools[0] as AnthropicTool;
      const openaiTool = openaiTools[0] as OpenAITool;
      const googleTool = googleTools[0] as GoogleTool;

      expect(anthropicTool.name).toBe('get_weather');
      expect(openaiTool.function.name).toBe('get_weather');
      expect(googleTool.name).toBe('get_weather');

      expect(anthropicTool.description).toBe(SAMPLE_TOOLS.weather.description);
      expect(openaiTool.function.description).toBe(SAMPLE_TOOLS.weather.description);
      expect(googleTool.description).toBe(SAMPLE_TOOLS.weather.description);

      // All should have required parameters
      expect(anthropicTool.input_schema.required).toEqual(['location']);
      expect(openaiTool.function.parameters.required).toEqual(['location']);
      expect(googleTool.parameters.required).toEqual(['location']);
    });
  });

  describe('Tool Response Formatting', () => {
    it('should format tool responses according to provider specifications', () => {
      const functionResult = SAMPLE_FUNCTION_RESULTS.weather;
      const toolName = 'get_weather';
      const toolCallId = 'test_call_id';

      const anthropicResponse = anthropicProvider.formatToolResponseMessage(
        functionResult,
        toolName,
        toolCallId
      );
      const openaiResponse = openaiProvider.formatToolResponseMessage(
        functionResult,
        toolName,
        toolCallId
      );
      const googleResponse = googleProvider.formatToolResponseMessage(functionResult, toolName);

      // Anthropic format - user message with content array containing tool_result
      expect(anthropicResponse).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolCallId,
            content: functionResult,
          },
        ],
      });

      // OpenAI format
      expect(openaiResponse).toEqual({
        role: 'tool',
        tool_call_id: toolCallId,
        name: toolName,
        content: functionResult,
      });

      // Google format - functionResponse part for user messages
      expect(googleResponse).toEqual({
        role: 'user',
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
      });
    });
  });

  describe('Message Shape Compatibility', () => {
    it('should handle base provider functionality consistently', () => {
      // All providers should inherit from BaseServiceProvider
      expect(anthropicProvider).toHaveProperty('agent_name', 'test-agent');
      expect(openaiProvider).toHaveProperty('agent_name', 'test-agent');
      expect(googleProvider).toHaveProperty('agent_name', 'test-agent');

      expect(anthropicProvider).toHaveProperty('service_provider');
      expect(openaiProvider).toHaveProperty('service_provider');
      expect(googleProvider).toHaveProperty('service_provider');

      expect(anthropicProvider).toHaveProperty('model_name');
      expect(openaiProvider).toHaveProperty('model_name');
      expect(googleProvider).toHaveProperty('model_name');

      // All should have system prompt handling
      expect(typeof (anthropicProvider as any).ensureSystemPrompt).toBe('function');
      expect(typeof (openaiProvider as any).ensureSystemPrompt).toBe('function');
      expect(typeof (googleProvider as any).ensureSystemPrompt).toBe('function');
    });

    it('should provide consistent interface methods', () => {
      // Core abstract methods that all providers must implement
      expect(typeof anthropicProvider.transformToolRegistry).toBe('function');
      expect(typeof openaiProvider.transformToolRegistry).toBe('function');
      expect(typeof googleProvider.transformToolRegistry).toBe('function');

      expect(typeof anthropicProvider.extractPartsFromResponse).toBe('function');
      expect(typeof openaiProvider.extractPartsFromResponse).toBe('function');
      expect(typeof googleProvider.extractPartsFromResponse).toBe('function');

      expect(typeof anthropicProvider.extractToolCallInfo).toBe('function');
      expect(typeof openaiProvider.extractToolCallInfo).toBe('function');
      expect(typeof googleProvider.extractToolCallInfo).toBe('function');

      expect(typeof anthropicProvider.formatToolResponseMessage).toBe('function');
      expect(typeof openaiProvider.formatToolResponseMessage).toBe('function');
      expect(typeof googleProvider.formatToolResponseMessage).toBe('function');

      // Main API method
      expect(typeof anthropicProvider.makeApiCall).toBe('function');
      expect(typeof openaiProvider.makeApiCall).toBe('function');
      expect(typeof googleProvider.makeApiCall).toBe('function');
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle malformed responses gracefully across all providers', () => {
      const malformedResponse = { invalid: 'response' };

      // Mock transport to return minimal data
      const mockTransport = {
        parseResponse: () => ({
          content: null,
          stopReason: 'error',
          usage: null,
        }),
      };

      vi.spyOn(anthropicProvider as any, 'transport', 'get').mockReturnValue(mockTransport);
      vi.spyOn(openaiProvider as any, 'transport', 'get').mockReturnValue(mockTransport);
      vi.spyOn(googleProvider as any, 'transport', 'get').mockReturnValue(mockTransport);

      expect(() => {
        anthropicProvider.extractPartsFromResponse(malformedResponse);
      }).not.toThrow();

      expect(() => {
        openaiProvider.extractPartsFromResponse(malformedResponse);
      }).not.toThrow();

      expect(() => {
        googleProvider.extractPartsFromResponse(malformedResponse);
      }).not.toThrow();
    });

    it('should handle empty tool calls gracefully across all providers', () => {
      const emptyToolCall = {};

      expect(() => {
        anthropicProvider.extractToolCallInfo(emptyToolCall);
      }).not.toThrow();

      expect(() => {
        openaiProvider.extractToolCallInfo(emptyToolCall);
      }).not.toThrow();

      expect(() => {
        googleProvider.extractToolCallInfo(emptyToolCall);
      }).not.toThrow();
    });
  });

  describe('Usage Information Consistency', () => {
    it('should provide consistent usage information structure', () => {
      const mockUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };

      const mockTransport = {
        parseResponse: () => ({
          content: 'Test',
          stopReason: 'stop',
          usage: mockUsage,
        }),
      };

      vi.spyOn(anthropicProvider as any, 'transport', 'get').mockReturnValue(mockTransport);
      vi.spyOn(openaiProvider as any, 'transport', 'get').mockReturnValue(mockTransport);
      vi.spyOn(googleProvider as any, 'transport', 'get').mockReturnValue(mockTransport);

      const anthropicParts = anthropicProvider.extractPartsFromResponse({});
      const openaiParts = openaiProvider.extractPartsFromResponse({});
      const googleParts = googleProvider.extractPartsFromResponse({});

      // All should have usage info
      expect(anthropicParts.usageInfo).toEqual(mockUsage);
      expect(openaiParts.usageInfo).toEqual(mockUsage);
      expect(googleParts.usageInfo).toEqual(mockUsage);
    });
  });
});
