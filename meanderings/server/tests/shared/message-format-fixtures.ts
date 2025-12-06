/**
 * Shared Message Format Fixtures
 *
 * These fixtures provide standardized test data for validating message formats
 * across both UI and server testing. They represent the expected WebSocket
 * message formats that should be sent from server to client.
 */

// ===== WEBSOCKET MESSAGE FORMATS =====

/**
 * WebSocket messages in the format expected by the UI
 * These are what the server should send over WebSocket connections
 */
export const WEBSOCKET_MESSAGE_FIXTURES = {
  // OpenAI Provider WebSocket Messages
  openai: {
    textOnly: {
      role: 'assistant',
      content: 'Hello, how can I help you today?',
      final_sentence: true,
    },

    toolCall: {
      role: 'assistant',
      content: "I'll help you with that using the appropriate tool.",
      tool_calls: [
        {
          id: 'call_123abc',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA", "unit": "celsius"}',
          },
        },
      ],
      final_sentence: true,
    },

    toolCallEmpty: {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call_456def',
          type: 'function',
          function: {
            name: 'wait_for_seconds',
            arguments: '{"seconds": 2}',
          },
        },
      ],
      final_sentence: true,
    },

    toolResult: {
      role: 'tool',
      tool_call_id: 'call_123abc',
      name: 'get_weather',
      content: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
    },
  },

  // Anthropic Provider WebSocket Messages
  anthropic: {
    textOnly: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello, how can I help you?',
        },
      ],
      final_sentence: true,
    },

    toolCall: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll help you with that. Let me use the appropriate tool.",
        },
        {
          type: 'tool_use',
          id: 'toolu_01A09q90qw90lq917835lq9',
          name: 'get_weather',
          input: {
            location: 'San Francisco, CA',
            unit: 'celsius',
          },
        },
      ],
      final_sentence: true,
    },

    toolCallEmpty: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'toolu_02B10r01qx01mr928946mr0',
          name: 'wait_for_seconds',
          input: {
            seconds: 2,
          },
        },
      ],
      final_sentence: true,
    },

    toolResult: {
      type: 'tool_result',
      tool_use_id: 'toolu_01A09q90qw90lq917835lq9',
      content: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
    },
  },

  // Gemini Provider WebSocket Messages
  gemini: {
    textOnly: {
      role: 'model',
      content: 'Hello, I can help you with that!',
      final_sentence: true,
    },

    toolCall: {
      role: 'model',
      parts: [
        {
          text: "I'll help you with that. Let me call the appropriate function.",
        },
        {
          functionCall: {
            name: 'get_weather',
            args: {
              location: 'San Francisco, CA',
              unit: 'celsius',
            },
          },
        },
      ],
      final_sentence: true,
    },

    toolCallEmpty: {
      role: 'model',
      parts: [
        {
          functionCall: {
            name: 'wait_for_seconds',
            args: {
              seconds: 2,
            },
          },
        },
      ],
      final_sentence: true,
    },

    toolResult: {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'get_weather',
            response: {
              content: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
            },
          },
        },
      ],
    },
  },

  // Groq Provider WebSocket Messages (OpenAI-compatible format)
  groq: {
    textOnly: {
      role: 'assistant',
      content: 'Hello from Groq! How can I assist you?',
      final_sentence: true,
    },

    toolCall: {
      role: 'assistant',
      content: "I'll use Groq's fast inference to help with that.",
      tool_calls: [
        {
          id: 'call_groq_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA", "unit": "celsius"}',
          },
        },
      ],
      final_sentence: true,
    },

    toolResult: {
      role: 'tool',
      tool_call_id: 'call_groq_123',
      name: 'get_weather',
      content: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
    },
  },

  // Ollama Provider WebSocket Messages (OpenAI-compatible format)
  ollama: {
    textOnly: {
      role: 'assistant',
      content: 'Hello from Ollama! Running locally to help you.',
      final_sentence: true,
    },

    toolCall: {
      role: 'assistant',
      content: 'Let me use a local model to assist with that.',
      tool_calls: [
        {
          id: 'call_ollama_456',
          type: 'function',
          function: {
            name: 'calculate',
            arguments: '{"expression": "42 * 2"}',
          },
        },
      ],
      final_sentence: true,
    },

    toolResult: {
      role: 'tool',
      tool_call_id: 'call_ollama_456',
      name: 'calculate',
      content: '84',
    },
  },

  // LMStudio Provider WebSocket Messages (OpenAI-compatible format)
  lmstudio: {
    textOnly: {
      role: 'assistant',
      content: 'Hello from LMStudio! Your local model is ready.',
      final_sentence: true,
    },

    toolCall: {
      role: 'assistant',
      content: "I'll process this with your local LMStudio model.",
      tool_calls: [
        {
          id: 'call_lmstudio_789',
          type: 'function',
          function: {
            name: 'get_current_datetime',
            arguments: '{}',
          },
        },
      ],
      final_sentence: true,
    },

    toolResult: {
      role: 'tool',
      tool_call_id: 'call_lmstudio_789',
      name: 'get_current_datetime',
      content: '2024-03-14T15:30:00Z',
    },
  },
};

// ===== CHAT HISTORY COMPATIBILITY =====

/**
 * Expected chat history messages after WebSocket messages are processed by UI
 * These validate that WebSocket messages are correctly converted to chat history
 */
export const CHAT_HISTORY_FIXTURES = {
  openai: {
    textMessage: {
      role: 'assistant',
      content: 'Hello, how can I help you today?',
    },

    toolCallMessage: {
      role: 'assistant',
      content: "I'll help you with that using the appropriate tool.",
      tool_calls: [
        {
          id: 'call_123abc',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA", "unit": "celsius"}',
          },
        },
      ],
    },

    toolResultMessage: {
      role: 'tool',
      tool_call_id: 'call_123abc',
      name: 'get_weather',
      content: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
    },
  },

  anthropic: {
    textMessage: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello, how can I help you?',
        },
      ],
    },

    toolCallMessage: {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll help you with that. Let me use the appropriate tool.",
        },
        {
          type: 'tool_use',
          id: 'toolu_01A09q90qw90lq917835lq9',
          name: 'get_weather',
          input: {
            location: 'San Francisco, CA',
            unit: 'celsius',
          },
        },
      ],
    },

    toolResultMessage: {
      type: 'tool_result',
      tool_use_id: 'toolu_01A09q90qw90lq917835lq9',
      content: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
    },
  },

  gemini: {
    textMessage: {
      role: 'model',
      content: 'Hello, I can help you with that!',
    },

    toolCallMessage: {
      role: 'model',
      parts: [
        {
          text: "I'll help you with that. Let me call the appropriate function.",
        },
        {
          functionCall: {
            name: 'get_weather',
            args: {
              location: 'San Francisco, CA',
              unit: 'celsius',
            },
          },
        },
      ],
    },

    toolResultMessage: {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'get_weather',
            response: {
              content: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
            },
          },
        },
      ],
    },
  },

  // Groq chat history (OpenAI-compatible)
  groq: {
    textMessage: {
      role: 'assistant',
      content: 'Hello from Groq! How can I assist you?',
    },

    toolCallMessage: {
      role: 'assistant',
      content: "I'll use Groq's fast inference to help with that.",
      tool_calls: [
        {
          id: 'call_groq_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco, CA", "unit": "celsius"}',
          },
        },
      ],
    },

    toolResultMessage: {
      role: 'tool',
      tool_call_id: 'call_groq_123',
      name: 'get_weather',
      content: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
    },
  },

  // Ollama chat history (OpenAI-compatible)
  ollama: {
    textMessage: {
      role: 'assistant',
      content: 'Hello from Ollama! Running locally to help you.',
    },

    toolCallMessage: {
      role: 'assistant',
      content: 'Let me use a local model to assist with that.',
      tool_calls: [
        {
          id: 'call_ollama_456',
          type: 'function',
          function: {
            name: 'calculate',
            arguments: '{"expression": "42 * 2"}',
          },
        },
      ],
    },

    toolResultMessage: {
      role: 'tool',
      tool_call_id: 'call_ollama_456',
      name: 'calculate',
      content: '84',
    },
  },

  // LMStudio chat history (OpenAI-compatible)
  lmstudio: {
    textMessage: {
      role: 'assistant',
      content: 'Hello from LMStudio! Your local model is ready.',
    },

    toolCallMessage: {
      role: 'assistant',
      content: "I'll process this with your local LMStudio model.",
      tool_calls: [
        {
          id: 'call_lmstudio_789',
          type: 'function',
          function: {
            name: 'get_current_datetime',
            arguments: '{}',
          },
        },
      ],
    },

    toolResultMessage: {
      role: 'tool',
      tool_call_id: 'call_lmstudio_789',
      name: 'get_current_datetime',
      content: '2024-03-14T15:30:00Z',
    },
  },
};

// ===== VALIDATION SCENARIOS =====

/**
 * Test scenarios that validate critical integration points
 */
export const INTEGRATION_SCENARIOS = {
  // Scenario 1: Gemini parts array bug validation
  geminiToolCallRoundTrip: {
    description: 'Validates Gemini tool calls include parts array in WebSocket messages',
    serverResponse: WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCall,
    expectedChatHistory: CHAT_HISTORY_FIXTURES.gemini.toolCallMessage,
    criticalValidation: (websocketMsg: any) => {
      return (
        websocketMsg.parts &&
        websocketMsg.parts.length > 0 &&
        websocketMsg.parts.some((part: any) => part.functionCall)
      );
    },
  },

  // Scenario 2: Empty content tool calls
  emptyContentToolCalls: {
    description: 'Validates tool calls work when content is empty',
    scenarios: [
      {
        provider: 'openai',
        websocketMsg: WEBSOCKET_MESSAGE_FIXTURES.openai.toolCallEmpty,
        expectedHistory: {
          role: 'assistant',
          content: '',
          tool_calls: WEBSOCKET_MESSAGE_FIXTURES.openai.toolCallEmpty.tool_calls,
        },
      },
      {
        provider: 'anthropic',
        websocketMsg: WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCallEmpty,
        expectedHistory: {
          role: 'assistant',
          content: WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCallEmpty.content,
        },
      },
      {
        provider: 'gemini',
        websocketMsg: WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCallEmpty,
        expectedHistory: {
          role: 'model',
          parts: WEBSOCKET_MESSAGE_FIXTURES.gemini.toolCallEmpty.parts,
        },
      },
    ],
  },

  // Scenario 3: Cross-provider conversation
  crossProviderConversation: {
    description: 'Validates switching providers mid-conversation',
    flow: [
      { provider: 'openai', message: WEBSOCKET_MESSAGE_FIXTURES.openai.textOnly },
      { provider: 'anthropic', message: WEBSOCKET_MESSAGE_FIXTURES.anthropic.toolCall },
      { provider: 'gemini', message: WEBSOCKET_MESSAGE_FIXTURES.gemini.toolResult },
    ],
  },
};

// ===== HELPER UTILITIES =====

/**
 * Utility functions for test validation
 */
export const MESSAGE_VALIDATION_UTILS = {
  /**
   * Validates a WebSocket message has the correct format for its provider
   */
  validateWebSocketFormat(
    provider: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' | 'lmstudio',
    message: any
  ): boolean {
    switch (provider) {
      case 'openai':
      case 'groq':
      case 'ollama':
      case 'lmstudio':
        return (
          message.role === 'assistant' &&
          (typeof message.content === 'string' || Array.isArray(message.tool_calls))
        );

      case 'anthropic':
        return (
          message.role === 'assistant' &&
          Array.isArray(message.content) &&
          message.content.every((block: any) => block.type)
        );

      case 'gemini':
        return (
          message.role === 'model' &&
          (typeof message.content === 'string' || Array.isArray(message.parts))
        );

      default:
        return false;
    }
  },

  /**
   * Extracts tool calls from any provider message format
   */
  extractToolCalls(
    provider: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' | 'lmstudio',
    message: any
  ): any[] {
    switch (provider) {
      case 'openai':
      case 'groq':
      case 'ollama':
      case 'lmstudio':
        return message.tool_calls || [];

      case 'anthropic':
        return message.content?.filter((block: any) => block.type === 'tool_use') || [];

      case 'gemini':
        return message.parts?.filter((part: any) => part.functionCall) || [];

      default:
        return [];
    }
  },

  /**
   * Validates that a message can be safely used in API calls
   */
  validateApiCallCompatibility(
    provider: 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama' | 'lmstudio',
    message: any
  ): boolean {
    const toolCalls = this.extractToolCalls(provider, message);

    // Check for the "Name cannot be empty" bug
    if (provider === 'gemini' && toolCalls.length > 0) {
      return toolCalls.every(
        (call: any) =>
          call.functionCall && call.functionCall.name && call.functionCall.name.trim() !== ''
      );
    }

    // Check OpenAI-compatible providers have valid tool call structure
    if (
      (provider === 'groq' || provider === 'ollama' || provider === 'lmstudio') &&
      toolCalls.length > 0
    ) {
      return toolCalls.every(
        (call: any) => call.function && call.function.name && call.function.arguments
      );
    }

    return true;
  },
};
