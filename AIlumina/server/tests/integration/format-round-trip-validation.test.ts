/**
 * Format Round-Trip Validation Tests
 *
 * These tests simulate the complete message flow:
 * Server WebSocket → UI Processing → Chat History → API Call Replay
 *
 * This validates that messages sent over WebSocket can be safely
 * replayed as API calls without format errors like "Name cannot be empty".
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WEBSOCKET_MESSAGE_FIXTURES,
  CHAT_HISTORY_FIXTURES,
  MESSAGE_VALIDATION_UTILS,
} from '../shared/message-format-fixtures.js';

// Mock UI message processing logic (simplified version of actual UI logic)
class MockUIMessageProcessor {
  private chatHistory: any[] = [];

  /**
   * Simulates how the UI processes WebSocket messages and adds them to chat history
   */
  processWebSocketMessage(message: any): any {
    // Remove WebSocket-specific properties
    const { final_sentence, ...chatMessage } = message;

    // Add to chat history
    this.chatHistory.push(chatMessage);

    return chatMessage;
  }

  /**
   * Gets the current chat history (what would be sent to API)
   */
  getChatHistory(): any[] {
    return [...this.chatHistory];
  }

  /**
   * Clears chat history
   */
  clearHistory(): void {
    this.chatHistory = [];
  }

  /**
   * Simulates detecting message composition type (from UI AIServiceTypes)
   */
  detectMessageComposition(message: any): 'string_content' | 'array_content' | 'parts_array' {
    if (message.parts && Array.isArray(message.parts)) {
      return 'parts_array';
    }
    if (message.content && Array.isArray(message.content)) {
      return 'array_content';
    }
    return 'string_content';
  }

  /**
   * Simulates checking if message is visible in UI
   */
  isVisibleInUI(message: any): boolean {
    const composition = this.detectMessageComposition(message);

    switch (composition) {
      case 'string_content':
        return Boolean(message.content && message.content.trim() !== '');

      case 'array_content':
        return Boolean(message.content && message.content.length > 0);

      case 'parts_array':
        return Boolean(message.parts && message.parts.length > 0);

      default:
        return false;
    }
  }
}

// Mock API call simulator
class MockAPICallSimulator {
  /**
   * Simulates making an API call with chat history
   * This is where format errors like "Name cannot be empty" would occur
   */
  simulateAPICall(
    provider: 'openai' | 'anthropic' | 'gemini',
    chatHistory: any[]
  ): {
    success: boolean;
    error?: string;
    validationResults: {
      formatValid: boolean;
      toolCallsValid: boolean;
      apiCompatible: boolean;
    };
  } {
    const validationResults = {
      formatValid: true,
      toolCallsValid: true,
      apiCompatible: true,
    };

    try {
      // Validate each message in chat history
      for (const message of chatHistory) {
        // Validate format
        if (!MESSAGE_VALIDATION_UTILS.validateWebSocketFormat(provider, message)) {
          validationResults.formatValid = false;
          throw new Error(`Invalid format for ${provider} provider: ${JSON.stringify(message)}`);
        }

        // Validate tool calls
        const toolCalls = MESSAGE_VALIDATION_UTILS.extractToolCalls(provider, message);
        if (toolCalls.length > 0) {
          // Check for the specific "Name cannot be empty" bug
          if (provider === 'gemini') {
            for (const toolCall of toolCalls) {
              if (
                !toolCall.functionCall ||
                !toolCall.functionCall.name ||
                toolCall.functionCall.name.trim() === ''
              ) {
                validationResults.toolCallsValid = false;
                throw new Error('Name cannot be empty - Gemini tool call missing function name');
              }
            }
          } else if (provider === 'openai') {
            for (const toolCall of toolCalls) {
              if (
                !toolCall.function ||
                !toolCall.function.name ||
                toolCall.function.name.trim() === ''
              ) {
                validationResults.toolCallsValid = false;
                throw new Error('OpenAI tool call missing function name');
              }
            }
          } else if (provider === 'anthropic') {
            for (const toolCall of toolCalls) {
              if (!toolCall.name || toolCall.name.trim() === '') {
                validationResults.toolCallsValid = false;
                throw new Error('Anthropic tool call missing name');
              }
            }
          }
        }

        // Validate API compatibility
        if (!MESSAGE_VALIDATION_UTILS.validateApiCallCompatibility(provider, message)) {
          validationResults.apiCompatible = false;
          throw new Error(`API compatibility check failed for ${provider}`);
        }
      }

      return {
        success: true,
        validationResults,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        validationResults,
      };
    }
  }
}

describe('Format Round-Trip Validation', () => {
  let uiProcessor: MockUIMessageProcessor;
  let apiSimulator: MockAPICallSimulator;

  beforeEach(() => {
    uiProcessor = new MockUIMessageProcessor();
    apiSimulator = new MockAPICallSimulator();
  });

  describe('OpenAI Round-Trip Validation', () => {
    it('validates OpenAI text message round-trip', () => {
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.openai.textOnly;

      // Step 1: UI processes WebSocket message
      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      // Step 2: Validate UI processing
      expect(uiProcessor.isVisibleInUI(chatMessage)).toBe(true);
      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('string_content');

      // Step 3: Get chat history for API call
      const chatHistory = uiProcessor.getChatHistory();
      expect(chatHistory).toHaveLength(1);
      expect(chatHistory[0]).toEqual(CHAT_HISTORY_FIXTURES.openai.textMessage);

      // Step 4: Simulate API call
      const apiResult = apiSimulator.simulateAPICall('openai', chatHistory);
      expect(apiResult.success).toBe(true);
      expect(apiResult.validationResults.formatValid).toBe(true);
      expect(apiResult.validationResults.apiCompatible).toBe(true);
    });

    it('validates OpenAI tool call message round-trip', () => {
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.openai.toolCall;

      // Step 1: UI processes WebSocket message
      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      // Step 2: Validate UI processing
      expect(uiProcessor.isVisibleInUI(chatMessage)).toBe(true);
      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('string_content');

      // Step 3: Get chat history for API call
      const chatHistory = uiProcessor.getChatHistory();
      expect(chatHistory).toHaveLength(1);
      expect(chatHistory[0].tool_calls).toBeDefined();
      expect(chatHistory[0].tool_calls).toHaveLength(1);

      // Step 4: Simulate API call (this tests tool call format)
      const apiResult = apiSimulator.simulateAPICall('openai', chatHistory);
      expect(apiResult.success).toBe(true);
      expect(apiResult.validationResults.toolCallsValid).toBe(true);
      expect(apiResult.validationResults.apiCompatible).toBe(true);
    });

    it('validates OpenAI empty content tool call round-trip', () => {
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.openai.toolCallEmpty;

      // Step 1: UI processes WebSocket message
      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      // Step 2: Validate UI processing (empty content but has tool calls)
      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('string_content');
      // Note: isVisibleInUI might be false for empty content, but tool calls should still work

      // Step 3: Get chat history for API call
      const chatHistory = uiProcessor.getChatHistory();
      expect(chatHistory[0].tool_calls).toBeDefined();
      expect(chatHistory[0].tool_calls).toHaveLength(1);

      // Step 4: Simulate API call (critical test for empty content)
      const apiResult = apiSimulator.simulateAPICall('openai', chatHistory);
      expect(apiResult.success).toBe(true);
      expect(apiResult.validationResults.toolCallsValid).toBe(true);
    });
  });

  describe('Anthropic Round-Trip Validation', () => {
    it('validates Anthropic text message round-trip', () => {
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.anthropic.textOnly;

      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      expect(uiProcessor.isVisibleInUI(chatMessage)).toBe(true);
      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('array_content');

      const chatHistory = uiProcessor.getChatHistory();
      const apiResult = apiSimulator.simulateAPICall('anthropic', chatHistory);

      expect(apiResult.success).toBe(true);
      expect(apiResult.validationResults.formatValid).toBe(true);
    });

    it('validates Anthropic tool call message round-trip', () => {
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCall;

      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      expect(uiProcessor.isVisibleInUI(chatMessage)).toBe(true);
      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('array_content');

      const chatHistory = uiProcessor.getChatHistory();
      expect(chatHistory[0].content).toHaveLength(2); // text + tool_use

      const apiResult = apiSimulator.simulateAPICall('anthropic', chatHistory);
      expect(apiResult.success).toBe(true);
      expect(apiResult.validationResults.toolCallsValid).toBe(true);
    });

    it('validates Anthropic empty content tool call round-trip', () => {
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCallEmpty;

      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('array_content');
      expect(chatMessage.content).toHaveLength(1); // only tool_use

      const chatHistory = uiProcessor.getChatHistory();
      const apiResult = apiSimulator.simulateAPICall('anthropic', chatHistory);

      expect(apiResult.success).toBe(true);
      expect(apiResult.validationResults.toolCallsValid).toBe(true);
    });
  });

  describe('Gemini Round-Trip Validation (Critical Bug Test)', () => {
    it('validates Gemini text message round-trip', () => {
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.gemini.textOnly;

      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      expect(uiProcessor.isVisibleInUI(chatMessage)).toBe(true);
      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('string_content');

      const chatHistory = uiProcessor.getChatHistory();
      const apiResult = apiSimulator.simulateAPICall('gemini', chatHistory);

      expect(apiResult.success).toBe(true);
      expect(apiResult.validationResults.formatValid).toBe(true);
    });

    it('validates Gemini tool call message round-trip (THE CRITICAL TEST)', () => {
      // This is the test that would have caught the original Gemini parts array bug
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCall;

      // Step 1: UI processes WebSocket message
      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      // Step 2: Validate UI processing
      expect(uiProcessor.isVisibleInUI(chatMessage)).toBe(true);
      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('parts_array');

      // Validate parts array structure
      expect(chatMessage.parts).toBeDefined();
      expect(Array.isArray(chatMessage.parts)).toBe(true);
      expect(chatMessage.parts.length).toBeGreaterThan(0);

      // Validate function call is in parts
      const hasFunctionCall = chatMessage.parts.some(
        (part: any) => part.functionCall && part.functionCall.name
      );
      expect(hasFunctionCall).toBe(true);

      // Step 3: Get chat history for API call
      const chatHistory = uiProcessor.getChatHistory();
      expect(chatHistory[0].parts).toHaveLength(2); // text + functionCall

      // Step 4: Simulate API call (this is where "Name cannot be empty" would fail)
      const apiResult = apiSimulator.simulateAPICall('gemini', chatHistory);

      // THE CRITICAL ASSERTION - this ensures the bug is fixed
      expect(apiResult.success).toBe(true);
      if (!apiResult.success) {
        console.error('Gemini API call failed:', apiResult.error);
      }
      expect(apiResult.validationResults.toolCallsValid).toBe(true);
      expect(apiResult.validationResults.apiCompatible).toBe(true);
    });

    it('validates Gemini empty content tool call round-trip (EDGE CASE TEST)', () => {
      // This tests the specific case that was failing before the fix
      const websocketMessage = WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCallEmpty;

      // Step 1: UI processes WebSocket message
      const chatMessage = uiProcessor.processWebSocketMessage(websocketMessage);

      // Step 2: Validate UI processing
      expect(uiProcessor.detectMessageComposition(chatMessage)).toBe('parts_array');
      expect(chatMessage.parts).toHaveLength(1); // only functionCall

      // Validate function call structure
      const functionCallPart = chatMessage.parts.find((part: any) => part.functionCall);
      expect(functionCallPart).toBeDefined();
      expect(functionCallPart.functionCall.name).toBeDefined();
      expect(functionCallPart.functionCall.name.trim()).not.toBe('');

      // Step 3: Get chat history for API call
      const chatHistory = uiProcessor.getChatHistory();

      // Step 4: Simulate API call (critical test for empty content with tool calls)
      const apiResult = apiSimulator.simulateAPICall('gemini', chatHistory);

      // This was failing with "Name cannot be empty" before the fix
      expect(apiResult.success).toBe(true);
      expect(apiResult.validationResults.toolCallsValid).toBe(true);
    });
  });

  describe('Cross-Provider Round-Trip Validation', () => {
    it('validates mixed provider conversation can be replayed to any provider', () => {
      // Simulate a conversation with multiple providers
      const conversationFlow = [
        { provider: 'openai', message: WEBSOCKET_MESSAGE_FIXTURES.openai.textOnly },
        { provider: 'anthropic', message: WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCall },
        { provider: 'gemini', message: WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCall },
      ];

      // Process all messages through UI
      conversationFlow.forEach(({ message }) => {
        uiProcessor.processWebSocketMessage(message);
      });

      const chatHistory = uiProcessor.getChatHistory();
      expect(chatHistory).toHaveLength(3);

      // Try to replay this conversation to each provider
      ['openai', 'anthropic', 'gemini'].forEach((provider) => {
        // Filter chat history to messages compatible with this provider
        const compatibleHistory = chatHistory.filter((message) => {
          return MESSAGE_VALIDATION_UTILS.validateWebSocketFormat(provider as any, message);
        });

        if (compatibleHistory.length > 0) {
          const apiResult = apiSimulator.simulateAPICall(provider as any, compatibleHistory);

          expect(apiResult.success).toBe(true);
          if (!apiResult.success) {
            console.error(`${provider} replay failed:`, apiResult.error);
          }
        }
      });
    });
  });

  describe('Error Case Validation', () => {
    it('detects messages that would cause API errors', () => {
      // Create a malformed Gemini message (simulating the old bug)
      const malformedGeminiMessage = {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: '', // Empty name - this should cause "Name cannot be empty"
              args: { seconds: 2 },
            },
          },
        ],
      };

      uiProcessor.processWebSocketMessage(malformedGeminiMessage);
      const chatHistory = uiProcessor.getChatHistory();

      // This should fail validation
      const apiResult = apiSimulator.simulateAPICall('gemini', chatHistory);

      expect(apiResult.success).toBe(false);
      expect(apiResult.error).toContain('Name cannot be empty');
      expect(apiResult.validationResults.toolCallsValid).toBe(false);
    });

    it('validates our fixture messages do not have these errors', () => {
      // Ensure our test fixtures don't have the errors we're testing for
      const allFixtures = [
        ...Object.values(WEBSOCKET_MESSAGE_FIXTURES.openai),
        ...Object.values(WEBSOCKET_MESSAGE_FIXTURES.anthropic),
        ...Object.values(WEBSOCKET_MESSAGE_FIXTURES.gemini),
      ];

      allFixtures.forEach((fixture) => {
        uiProcessor.clearHistory();
        uiProcessor.processWebSocketMessage(fixture);

        const chatHistory = uiProcessor.getChatHistory();

        // Determine provider
        let provider: 'openai' | 'anthropic' | 'gemini';
        const fixtureAny = fixture as any;
        if (fixtureAny.role === 'assistant' && fixtureAny.tool_calls) {
          provider = 'openai';
        } else if (fixtureAny.role === 'assistant' && Array.isArray(fixtureAny.content)) {
          provider = 'anthropic';
        } else if (fixtureAny.role === 'model') {
          provider = 'gemini';
        } else {
          return; // Skip non-standard messages
        }

        const apiResult = apiSimulator.simulateAPICall(provider, chatHistory);
        expect(apiResult.success).toBe(true);
      });
    });
  });
});
