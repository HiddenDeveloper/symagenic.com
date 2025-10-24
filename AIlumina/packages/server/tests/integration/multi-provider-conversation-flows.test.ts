/**
 * Multi-Provider Conversation Flow Tests
 *
 * These tests validate complex conversation scenarios where different AI providers
 * are used within the same conversation. This ensures message format compatibility
 * and chat history consistency across provider switches.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockWebSocket } from '../fixtures/websocket-mock.js';
import { WEBSOCKET_MESSAGE_FIXTURES } from '../shared/message-format-fixtures.js';

// Enhanced conversation flow simulator
class ConversationFlowSimulator {
  private mockWebSocket: MockWebSocket;
  private chatHistory: Array<Record<string, unknown>> = [];

  constructor() {
    this.mockWebSocket = new MockWebSocket();
  }

  /**
   * Simulates sending a message from a specific provider
   */
  sendProviderMessage(
    provider: 'openai' | 'anthropic' | 'gemini',
    messageType: string,
    content?: string
  ): void {
    let message: Record<string, unknown>;

    switch (provider) {
      case 'openai':
        message =
          messageType === 'text'
            ? {
                ...WEBSOCKET_MESSAGE_FIXTURES.openai.textOnly,
                content: content || WEBSOCKET_MESSAGE_FIXTURES.openai.textOnly.content,
              }
            : WEBSOCKET_MESSAGE_FIXTURES.openai.toolCall;
        break;
      case 'anthropic':
        message =
          messageType === 'text'
            ? {
                ...WEBSOCKET_MESSAGE_FIXTURES.anthropic.textOnly,
                content: [{ type: 'text', text: content || 'Anthropic response' }],
              }
            : WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCall;
        break;
      case 'gemini':
        message =
          messageType === 'text'
            ? {
                ...WEBSOCKET_MESSAGE_FIXTURES.gemini.textOnly,
                content: content || WEBSOCKET_MESSAGE_FIXTURES.gemini.textOnly.content,
              }
            : WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCall;
        break;
    }

    this.mockWebSocket.send(JSON.stringify(message));

    // Add to chat history (remove WebSocket-specific properties)
    const { final_sentence, ...chatMessage } = message as {
      final_sentence?: boolean;
      [key: string]: unknown;
    };
    this.chatHistory.push(chatMessage);
  }

  /**
   * Simulates a user message
   */
  sendUserMessage(content: string): void {
    const userMessage = {
      role: 'user',
      content: content,
    };

    this.mockWebSocket.send(JSON.stringify(userMessage));
    this.chatHistory.push(userMessage);
  }

  /**
   * Gets the current chat history
   */
  getChatHistory(): any[] {
    return [...this.chatHistory];
  }

  /**
   * Gets captured WebSocket messages
   */
  getWebSocketMessages(): any[] {
    return this.mockWebSocket.getMessages().map((m) => m.data);
  }

  /**
   * Clears the conversation
   */
  clear(): void {
    this.mockWebSocket.clear();
    this.chatHistory = [];
  }

  /**
   * Validates conversation consistency
   */
  validateConversation(): {
    valid: boolean;
    errors: string[];
    stats: {
      totalMessages: number;
      providerMessages: Record<string, number>;
      userMessages: number;
      toolCalls: number;
    };
  } {
    const errors: string[] = [];
    const stats = {
      totalMessages: this.chatHistory.length,
      providerMessages: { openai: 0, anthropic: 0, gemini: 0, unknown: 0 },
      userMessages: 0,
      toolCalls: 0,
    };

    for (const message of this.chatHistory) {
      // Count message types
      if (message.role === 'user') {
        stats.userMessages++;
      } else if (message.role === 'assistant') {
        if (Array.isArray(message.content)) {
          stats.providerMessages.anthropic++;
        } else {
          stats.providerMessages.openai++;
        }
      } else if (message.role === 'model') {
        stats.providerMessages.gemini++;
      } else {
        stats.providerMessages.unknown++;
      }

      // Count tool calls
      if (message.tool_calls) {
        stats.toolCalls += message.tool_calls.length;
      } else if (Array.isArray(message.content)) {
        stats.toolCalls += message.content.filter((block: any) => block.type === 'tool_use').length;
      } else if (Array.isArray(message.parts)) {
        stats.toolCalls += message.parts.filter((part: any) => part.functionCall).length;
      }

      // Validate message format
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        // Anthropic format
        if (!message.content.every((block: any) => block.type)) {
          errors.push(`Invalid Anthropic content block format: ${JSON.stringify(message)}`);
        }
      } else if (message.role === 'model' && Array.isArray(message.parts)) {
        // Gemini format with parts
        if (
          !message.parts.every(
            (part: any) => part.text || part.functionCall || part.functionResponse
          )
        ) {
          errors.push(`Invalid Gemini parts format: ${JSON.stringify(message)}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      stats,
    };
  }
}

describe('Multi-Provider Conversation Flow Tests', () => {
  let conversationSim: ConversationFlowSimulator;

  beforeEach(() => {
    conversationSim = new ConversationFlowSimulator();
  });

  describe('Basic Multi-Provider Conversations', () => {
    it('validates simple text conversation across all providers', () => {
      // Simulate a conversation where user switches between providers
      conversationSim.sendUserMessage('Hello, I need help with something');
      conversationSim.sendProviderMessage('openai', 'text', "Hello! I'm OpenAI, how can I help?");

      conversationSim.sendUserMessage('Actually, let me try a different provider');
      conversationSim.sendProviderMessage(
        'anthropic',
        'text',
        "Hi! I'm Claude from Anthropic, what can I do for you?"
      );

      conversationSim.sendUserMessage('Let me try one more provider');
      conversationSim.sendProviderMessage(
        'gemini',
        'text',
        "Greetings! I'm Gemini from Google, ready to assist!"
      );

      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);
      expect(validation.stats.totalMessages).toBe(6); // 3 user + 3 assistant
      expect(validation.stats.userMessages).toBe(3);
      expect(validation.stats.providerMessages.openai).toBe(1);
      expect(validation.stats.providerMessages.anthropic).toBe(1);
      expect(validation.stats.providerMessages.gemini).toBe(1);
    });

    it('validates tool calling across different providers', () => {
      conversationSim.sendUserMessage('I need to check the weather');
      conversationSim.sendProviderMessage('openai', 'tool');

      conversationSim.sendUserMessage('Now let me try with Anthropic');
      conversationSim.sendProviderMessage('anthropic', 'tool');

      conversationSim.sendUserMessage('Finally, let me use Gemini');
      conversationSim.sendProviderMessage('gemini', 'tool');

      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);
      expect(validation.stats.toolCalls).toBe(3); // One from each provider
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Complex Conversation Scenarios', () => {
    it('validates mixed content and tool call conversation', () => {
      // Simulate a realistic conversation with mixed message types
      conversationSim.sendUserMessage('Hi, I need help with weather and calculations');

      // OpenAI handles initial response
      conversationSim.sendProviderMessage(
        'openai',
        'text',
        'I can help with both! Let me start with the weather.'
      );
      conversationSim.sendProviderMessage('openai', 'tool'); // Weather tool call

      // User asks for calculation
      conversationSim.sendUserMessage('Great! Now can you calculate 15 * 8?');

      // Switch to Anthropic for calculation
      conversationSim.sendProviderMessage(
        'anthropic',
        'text',
        "I'll help you with that calculation."
      );
      conversationSim.sendProviderMessage('anthropic', 'tool'); // Calculator tool call

      // User wants to confirm with Gemini
      conversationSim.sendUserMessage('Can you double-check that calculation?');
      conversationSim.sendProviderMessage('gemini', 'tool'); // Another calculation

      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);
      expect(validation.stats.totalMessages).toBe(8); // 3 user + 5 assistant/model (one provider sends only tool, not text+tool)
      expect(validation.stats.toolCalls).toBe(3); // Three tool calls across providers

      // Validate each provider contributed
      expect(validation.stats.providerMessages.openai).toBe(2); // text + tool
      expect(validation.stats.providerMessages.anthropic).toBe(2); // text + tool
      expect(validation.stats.providerMessages.gemini).toBe(1); // tool only
    });

    it('validates provider switching mid-tool-execution', () => {
      // Start with OpenAI tool call
      conversationSim.sendUserMessage('Get weather for San Francisco');
      conversationSim.sendProviderMessage('openai', 'tool');

      // User interrupts and switches to Anthropic
      conversationSim.sendUserMessage(
        'Actually, use Anthropic to get weather for New York instead'
      );
      conversationSim.sendProviderMessage('anthropic', 'tool');

      // Finally switch to Gemini for a different location
      conversationSim.sendUserMessage('And can Gemini get weather for London?');
      conversationSim.sendProviderMessage('gemini', 'tool');

      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);
      expect(validation.stats.toolCalls).toBe(3);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('validates conversation with only tool calls (no text)', () => {
      // Conversation where every response is a tool call
      conversationSim.sendUserMessage('Just run tools, no explanations needed');

      conversationSim.sendProviderMessage('openai', 'tool');
      conversationSim.sendProviderMessage('anthropic', 'tool');
      conversationSim.sendProviderMessage('gemini', 'tool');

      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);
      expect(validation.stats.toolCalls).toBe(3);
      expect(validation.stats.totalMessages).toBe(4); // 1 user + 3 tool responses
    });

    it('validates conversation with rapid provider switching', () => {
      // Simulate rapid switching between providers
      for (let i = 0; i < 10; i++) {
        conversationSim.sendUserMessage(`Message ${i + 1}`);

        const providers = ['openai', 'anthropic', 'gemini'] as const;
        const provider = providers[i % 3];
        const messageType = i % 2 === 0 ? 'text' : 'tool';

        conversationSim.sendProviderMessage(
          provider,
          messageType,
          `Response ${i + 1} from ${provider}`
        );
      }

      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);
      expect(validation.stats.totalMessages).toBe(20); // 10 user + 10 provider
      expect(validation.stats.userMessages).toBe(10);

      // Should have roughly equal distribution across providers
      const totalProviderMessages =
        validation.stats.providerMessages.openai +
        validation.stats.providerMessages.anthropic +
        validation.stats.providerMessages.gemini;
      expect(totalProviderMessages).toBe(10);
    });
  });

  describe('Format Consistency Validation', () => {
    it('validates that chat history maintains format consistency', () => {
      // Create a conversation with all provider message types
      conversationSim.sendUserMessage('Test all provider formats');

      // OpenAI text and tool
      conversationSim.sendProviderMessage('openai', 'text');
      conversationSim.sendProviderMessage('openai', 'tool');

      // Anthropic text and tool
      conversationSim.sendProviderMessage('anthropic', 'text');
      conversationSim.sendProviderMessage('anthropic', 'tool');

      // Gemini text and tool
      conversationSim.sendProviderMessage('gemini', 'text');
      conversationSim.sendProviderMessage('gemini', 'tool');

      const chatHistory = conversationSim.getChatHistory();
      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);

      // Validate each message can be identified by its format
      const openaiMessages = chatHistory.filter(
        (m) => m.role === 'assistant' && !Array.isArray(m.content) && m.role !== 'model'
      );
      const anthropicMessages = chatHistory.filter(
        (m) => m.role === 'assistant' && Array.isArray(m.content)
      );
      const geminiMessages = chatHistory.filter((m) => m.role === 'model');

      expect(openaiMessages.length).toBe(2); // text + tool
      expect(anthropicMessages.length).toBe(2); // text + tool
      expect(geminiMessages.length).toBe(2); // text + tool

      // Validate format-specific properties

      // OpenAI tool calls
      const openaiToolMessage = openaiMessages.find((m) => m.tool_calls);
      expect(openaiToolMessage).toBeDefined();
      expect(openaiToolMessage!.tool_calls).toHaveLength(1);
      expect(openaiToolMessage!.tool_calls[0].function.name).toBeDefined();

      // Anthropic content blocks
      const anthropicToolMessage = anthropicMessages.find((m) =>
        m.content.some((block: any) => block.type === 'tool_use')
      );
      expect(anthropicToolMessage).toBeDefined();

      // Gemini parts array
      const geminiToolMessage = geminiMessages.find(
        (m) => m.parts && m.parts.some((part: any) => part.functionCall)
      );
      expect(geminiToolMessage).toBeDefined();
      expect(geminiToolMessage!.parts.some((part: any) => part.functionCall)).toBe(true);
    });

    it('validates WebSocket to chat history format preservation', () => {
      // Test that WebSocket message formats are preserved in chat history
      conversationSim.sendProviderMessage('gemini', 'tool');

      const websocketMessages = conversationSim.getWebSocketMessages();
      const chatHistory = conversationSim.getChatHistory();

      // Find the Gemini tool message
      const websocketGeminiTool = websocketMessages.find(
        (m) => m.role === 'model' && m.parts && m.parts.some((p: any) => p.functionCall)
      );
      const chatHistoryGeminiTool = chatHistory.find(
        (m) => m.role === 'model' && m.parts && m.parts.some((p: any) => p.functionCall)
      );

      expect(websocketGeminiTool).toBeDefined();
      expect(chatHistoryGeminiTool).toBeDefined();

      // Validate that the critical fix is preserved (parts array with function call)
      expect(websocketGeminiTool.parts).toEqual(chatHistoryGeminiTool.parts);
      expect(
        websocketGeminiTool.parts.some(
          (p: any) => p.functionCall && p.functionCall.name && p.functionCall.name.trim() !== ''
        )
      ).toBe(true);
    });
  });

  describe('Real-World Conversation Patterns', () => {
    it('validates collaborative problem-solving conversation', () => {
      // Simulate a conversation where different providers handle different aspects
      conversationSim.sendUserMessage('I need to analyze weather data and create a report');

      // OpenAI gets the weather data
      conversationSim.sendProviderMessage('openai', 'text', "I'll get the weather data for you");
      conversationSim.sendProviderMessage('openai', 'tool'); // Weather API call

      conversationSim.sendUserMessage('Great! Now analyze this data statistically');

      // Anthropic handles analysis
      conversationSim.sendProviderMessage(
        'anthropic',
        'text',
        "I'll analyze the statistical patterns"
      );
      conversationSim.sendProviderMessage('anthropic', 'tool'); // Analysis tool

      conversationSim.sendUserMessage('Finally, help me create visualizations');

      // Gemini handles visualization
      conversationSim.sendProviderMessage('gemini', 'text', "I'll create visualizations for you");
      conversationSim.sendProviderMessage('gemini', 'tool'); // Visualization tool

      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);
      expect(validation.stats.toolCalls).toBe(3); // Three different types of tools
      expect(validation.stats.totalMessages).toBe(9); // 3 user + 6 provider

      // Each provider contributed both text and tool calls
      expect(validation.stats.providerMessages.openai).toBe(2);
      expect(validation.stats.providerMessages.anthropic).toBe(2);
      expect(validation.stats.providerMessages.gemini).toBe(2);
    });

    it('validates error recovery across providers', () => {
      // Simulate a conversation where one provider fails and another takes over
      conversationSim.sendUserMessage('Calculate complex mathematics');

      // OpenAI attempts calculation
      conversationSim.sendProviderMessage('openai', 'text', 'Let me try this calculation');
      conversationSim.sendProviderMessage('openai', 'tool'); // Tool call

      conversationSim.sendUserMessage("That didn't work, try a different approach");

      // Switch to Anthropic with different strategy
      conversationSim.sendProviderMessage(
        'anthropic',
        'text',
        "I'll use a different mathematical approach"
      );
      conversationSim.sendProviderMessage('anthropic', 'tool'); // Different tool call

      conversationSim.sendUserMessage('Perfect! Can you verify the result?');

      // Gemini verifies
      conversationSim.sendProviderMessage('gemini', 'text', "I'll verify that calculation");
      conversationSim.sendProviderMessage('gemini', 'tool'); // Verification tool

      const validation = conversationSim.validateConversation();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Validate conversation flow makes sense
      const chatHistory = conversationSim.getChatHistory();
      expect(chatHistory).toHaveLength(9);

      // Check that message sequence is preserved
      expect(chatHistory[0].role).toBe('user');
      expect(chatHistory[1].role).toBe('assistant'); // OpenAI
      expect(chatHistory[3].role).toBe('user'); // User message before Anthropic
      expect(chatHistory[4].role).toBe('assistant'); // Anthropic (after user message)
      expect(chatHistory[7].role).toBe('model'); // Gemini (after user message)
    });
  });
});
