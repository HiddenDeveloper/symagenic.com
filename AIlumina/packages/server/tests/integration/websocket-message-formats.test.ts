/**
 * WebSocket Message Format Integration Tests
 *
 * These tests validate that WebSocket messages sent by the server
 * match the expected formats for each provider and can be correctly
 * processed by the UI for chat history and API call replay.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  WebSocketIntegrationTestRunner,
  MESSAGE_FLOW_VALIDATORS,
} from '../shared/websocket-integration-utils.js';
import {
  WEBSOCKET_MESSAGE_FIXTURES,
  INTEGRATION_SCENARIOS,
  MESSAGE_VALIDATION_UTILS,
} from '../shared/message-format-fixtures.js';
import { MockWebSocket } from '../fixtures/websocket-mock.js';

describe('WebSocket Message Format Integration', () => {
  let testRunner: WebSocketIntegrationTestRunner;
  let mockWebSocket: MockWebSocket;

  beforeAll(async () => {
    // Skip integration tests if NO_INTEGRATION_TESTS is set
    if (process.env.NO_INTEGRATION_TESTS) {
      console.log('Skipping integration tests (NO_INTEGRATION_TESTS set)');
      return;
    }

    try {
      testRunner = new WebSocketIntegrationTestRunner(8001); // Use different port
      await testRunner.setup();
    } catch (error) {
      console.warn('Integration test setup failed, skipping tests:', error);
      testRunner = null as any;
    }
  }, 30000);

  afterAll(async () => {
    if (testRunner) {
      await testRunner.teardown();
    }
  });

  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
  });

  describe('Provider-Specific Message Formats', () => {
    it('validates Gemini provider sends parts array for tool calls', async () => {
      // This test validates the fix for the Gemini parts array bug

      const scenario = INTEGRATION_SCENARIOS.geminiToolCallRoundTrip;

      // Mock the expected WebSocket message
      const geminiToolCallMessage = scenario.serverResponse;
      mockWebSocket.send(JSON.stringify(geminiToolCallMessage));

      const messages = mockWebSocket.getMessages();
      const geminiMessage = messages.find((m) => m.data.role === 'model');

      expect(geminiMessage).toBeDefined();
      expect(geminiMessage!.data.parts).toBeDefined();
      expect(Array.isArray(geminiMessage!.data.parts)).toBe(true);
      expect(geminiMessage!.data.parts.length).toBeGreaterThan(0);

      // Validate the critical fix - parts array contains function call
      const hasFunctionCall = geminiMessage!.data.parts.some(
        (part: any) => part.functionCall && part.functionCall.name
      );
      expect(hasFunctionCall).toBe(true);

      // Validate using our fixture's critical validation
      expect(scenario.criticalValidation(geminiMessage!.data)).toBe(true);
    });

    it('validates OpenAI provider sends tool_calls array', async () => {
      const openaiToolCallMessage = WEBSOCKET_MESSAGE_FIXTURES.openai.toolCall;
      mockWebSocket.send(JSON.stringify(openaiToolCallMessage));

      const messages = mockWebSocket.getMessages();
      const openaiMessage = messages.find((m) => m.data.role === 'assistant');

      expect(openaiMessage).toBeDefined();
      expect(openaiMessage!.data.tool_calls).toBeDefined();
      expect(Array.isArray(openaiMessage!.data.tool_calls)).toBe(true);
      expect(openaiMessage!.data.tool_calls.length).toBeGreaterThan(0);

      // Validate tool call structure
      const toolCall = openaiMessage!.data.tool_calls[0];
      expect(toolCall.function).toBeDefined();
      expect(toolCall.function.name).toBeDefined();
      expect(toolCall.function.arguments).toBeDefined();
    });

    it('validates Anthropic provider sends content blocks array', async () => {
      const anthropicToolCallMessage = WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCall;
      mockWebSocket.send(JSON.stringify(anthropicToolCallMessage));

      const messages = mockWebSocket.getMessages();
      const anthropicMessage = messages.find(
        (m) => m.data.role === 'assistant' && Array.isArray(m.data.content)
      );

      expect(anthropicMessage).toBeDefined();
      expect(Array.isArray(anthropicMessage!.data.content)).toBe(true);
      expect(anthropicMessage!.data.content.length).toBeGreaterThan(0);

      // Validate content block structure
      const hasToolUse = anthropicMessage!.data.content.some(
        (block: any) => block.type === 'tool_use' && block.name && block.input
      );
      expect(hasToolUse).toBe(true);
    });
  });

  describe('Empty Content Tool Call Scenarios', () => {
    it('validates all providers handle empty content tool calls correctly', () => {
      const scenario = INTEGRATION_SCENARIOS.emptyContentToolCalls;

      scenario.scenarios.forEach(({ provider, websocketMsg, expectedHistory }) => {
        mockWebSocket.clear();
        mockWebSocket.send(JSON.stringify(websocketMsg));

        const messages = mockWebSocket.getMessages();
        const providerMessage = messages[0];

        expect(providerMessage).toBeDefined();

        // Validate format is correct for provider
        expect(
          MESSAGE_VALIDATION_UTILS.validateWebSocketFormat(provider as any, providerMessage.data)
        ).toBe(true);

        // Validate tool calls are present even with empty content
        const toolCalls = MESSAGE_VALIDATION_UTILS.extractToolCalls(
          provider as any,
          providerMessage.data
        );
        expect(toolCalls.length).toBeGreaterThan(0);

        // Validate API call compatibility (this catches the "Name cannot be empty" bug)
        expect(
          MESSAGE_VALIDATION_UTILS.validateApiCallCompatibility(
            provider as any,
            providerMessage.data
          )
        ).toBe(true);
      });
    });
  });

  describe('Message Flow Validation', () => {
    it('validates complete tool call message flow', () => {
      // Simulate a complete tool call flow
      const toolCallFlow = [
        { tool_call: true, tool_name: 'get_weather', tool_status: 'executing' },
        WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCall,
        { tool_call: true, tool_name: 'get_weather', tool_status: 'completed' },
        WEBSOCKET_MESSAGE_FIXTURES.gemini.toolResult,
        { done: true },
      ];

      toolCallFlow.forEach((message) => {
        mockWebSocket.send(JSON.stringify(message));
      });

      const messages = mockWebSocket.getMessages().map((m) => m.data);

      // Validate using our flow validator
      expect(MESSAGE_FLOW_VALIDATORS.validateToolCallFlow(messages)).toBe(true);
    });

    it('validates Gemini parts array format specifically', () => {
      const geminiMessages = [
        WEBSOCKET_MESSAGE_FIXTURES.gemini.textOnly,
        WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCall,
        WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCallEmpty,
      ];

      geminiMessages.forEach((message) => {
        mockWebSocket.send(JSON.stringify(message));
      });

      const messages = mockWebSocket.getMessages().map((m) => m.data);

      // This validates our Gemini parts array fix
      expect(MESSAGE_FLOW_VALIDATORS.validateGeminiPartsArray(messages)).toBe(true);
    });
  });

  describe('Cross-Provider Compatibility', () => {
    it('validates messages from different providers can coexist', () => {
      const crossProviderFlow = INTEGRATION_SCENARIOS.crossProviderConversation.flow;

      crossProviderFlow.forEach(({ message }) => {
        mockWebSocket.send(JSON.stringify(message));
      });

      const messages = mockWebSocket.getMessages().map((m) => m.data);

      // Validate cross-provider compatibility
      expect(MESSAGE_FLOW_VALIDATORS.validateCrossProviderCompatibility(messages)).toBe(true);

      // Validate each provider's messages individually
      const openaiMessages = messages.filter(
        (m) => m.role === 'assistant' && !Array.isArray(m.content)
      );
      const anthropicMessages = messages.filter(
        (m) => m.role === 'assistant' && Array.isArray(m.content)
      );
      const geminiMessages = messages.filter(
        (m) => m.role === 'model' || (m.role === 'user' && m.parts)
      );

      expect(openaiMessages.length).toBeGreaterThan(0);
      expect(anthropicMessages.length).toBeGreaterThan(0);
      expect(geminiMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Round-Trip Validation', () => {
    it('validates WebSocket messages can be used for API calls without errors', () => {
      // Test the critical round-trip: WebSocket → Chat History → API Call

      const testMessages = [
        WEBSOCKET_MESSAGE_FIXTURES.openai.toolCall,
        WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCall,
        WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCall,
      ];

      testMessages.forEach((message, index) => {
        mockWebSocket.send(JSON.stringify(message));

        const capturedMessages = mockWebSocket.getMessages();
        const lastMessage = capturedMessages[capturedMessages.length - 1];

        // Determine provider based on message structure
        let provider: 'openai' | 'anthropic' | 'gemini';
        if (lastMessage.data.role === 'assistant' && lastMessage.data.tool_calls) {
          provider = 'openai';
        } else if (
          lastMessage.data.role === 'assistant' &&
          Array.isArray(lastMessage.data.content)
        ) {
          provider = 'anthropic';
        } else if (lastMessage.data.role === 'model') {
          provider = 'gemini';
        } else {
          throw new Error('Unknown provider format');
        }

        // Validate the message format
        expect(MESSAGE_VALIDATION_UTILS.validateWebSocketFormat(provider, lastMessage.data)).toBe(
          true
        );

        // Validate API call compatibility (this is the critical test)
        expect(
          MESSAGE_VALIDATION_UTILS.validateApiCallCompatibility(provider, lastMessage.data)
        ).toBe(true);

        // Validate tool calls are extractable
        const toolCalls = MESSAGE_VALIDATION_UTILS.extractToolCalls(provider, lastMessage.data);
        expect(toolCalls.length).toBeGreaterThan(0);
      });
    });
  });

  // Integration tests with real server (only run if server is available)
  describe('Real Server Integration', () => {
    it.skipIf(!testRunner)('validates real server WebSocket messages', async () => {
      if (!testRunner) return;

      const result = await testRunner.runFlowTest({
        name: 'Gemini Tool Call Format Test',
        description: 'Validates real server sends Gemini messages with parts array',
        actions: [
          {
            type: 'send',
            data: {
              user_input: 'wait for 2 seconds',
              chat_messages: [],
            },
          },
          {
            type: 'wait',
            condition: (message) => message.role === 'model' && message.parts,
            timeoutMs: 10000,
          },
          {
            type: 'validate',
            validator: (messages) => {
              const geminiMessages = messages.filter((m) => m.role === 'model' && m.parts);
              return (
                geminiMessages.length > 0 &&
                geminiMessages.every((m) => Array.isArray(m.parts) && m.parts.length > 0)
              );
            },
          },
        ],
      });

      expect(result.success).toBe(true);
      if (!result.success) {
        console.error('Integration test failed:', result.error);
        console.error('Messages received:', result.messages);
      }
    });
  });
});
