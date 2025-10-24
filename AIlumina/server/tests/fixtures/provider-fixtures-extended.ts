/**
 * Extended Provider Response Fixtures
 *
 * Comprehensive fixtures for all provider types including OpenAI-compatible providers,
 * streaming responses, and error scenarios.
 */

// ===== OPENAI-COMPATIBLE PROVIDER MOCKS (Groq, Ollama, LMStudio) =====

/**
 * Creates a mock OpenAI-compatible text response
 * Used by Groq, Ollama, and LMStudio providers
 */
export function createOpenAICompatibleTextResponse(
  content: string,
  model = 'llama-3.1-70b-versatile'
) {
  return {
    id: 'chatcmpl-compatible-123',
    object: 'chat.completion',
    created: Date.now(),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content,
        },
        finish_reason: 'stop',
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 25,
      total_tokens: 37,
    },
    system_fingerprint: null,
  };
}

/**
 * Creates a mock OpenAI-compatible tool call response
 */
export function createOpenAICompatibleToolResponse(
  toolName: string,
  args: Record<string, any>,
  model = 'llama-3.1-70b-versatile'
) {
  return {
    id: 'chatcmpl-compatible-456',
    object: 'chat.completion',
    created: Date.now(),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_compatible_789',
              type: 'function',
              function: {
                name: toolName,
                arguments: JSON.stringify(args),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: 82,
      completion_tokens: 18,
      total_tokens: 100,
    },
    system_fingerprint: null,
  };
}

// ===== GROQ SPECIFIC MOCKS =====

export function createGroqTextResponse(content: string) {
  return createOpenAICompatibleTextResponse(content, 'llama3-groq-70b-8192-tool-use-preview');
}

export function createGroqToolResponse(toolName: string, args: Record<string, any>) {
  return createOpenAICompatibleToolResponse(
    toolName,
    args,
    'llama3-groq-70b-8192-tool-use-preview'
  );
}

// ===== OLLAMA SPECIFIC MOCKS =====

export function createOllamaTextResponse(content: string) {
  const response = createOpenAICompatibleTextResponse(content, 'llama3.1:latest');
  // Ollama includes additional metadata
  return {
    ...response,
    model: 'llama3.1:latest',
    created_at: new Date().toISOString(),
    done: true,
    context: [1, 2, 3], // Mock context tokens
    total_duration: 5000000000,
    load_duration: 1000000000,
    prompt_eval_count: 12,
    prompt_eval_duration: 500000000,
    eval_count: 25,
    eval_duration: 3500000000,
  };
}

export function createOllamaToolResponse(toolName: string, args: Record<string, any>) {
  const response = createOpenAICompatibleToolResponse(toolName, args, 'llama3.1:latest');
  return {
    ...response,
    model: 'llama3.1:latest',
    created_at: new Date().toISOString(),
    done: true,
  };
}

// ===== LMSTUDIO SPECIFIC MOCKS =====

export function createLMStudioTextResponse(content: string) {
  return {
    ...createOpenAICompatibleTextResponse(content, 'local-model'),
    model: 'local-model',
    // LMStudio includes server info
    server: 'lmstudio/0.2.0',
  };
}

export function createLMStudioToolResponse(toolName: string, args: Record<string, any>) {
  return {
    ...createOpenAICompatibleToolResponse(toolName, args, 'local-model'),
    model: 'local-model',
    server: 'lmstudio/0.2.0',
  };
}

// ===== STREAMING RESPONSE MOCKS =====

/**
 * Creates streaming chunks for OpenAI/OpenAI-compatible providers
 */
export function createOpenAIStreamingChunks(content: string) {
  const words = content.split(' ');
  const chunks = [];

  // Initial chunk
  chunks.push({
    id: 'chatcmpl-stream-123',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', content: '' },
        finish_reason: null,
      },
    ],
  });

  // Content chunks
  for (const word of words) {
    chunks.push({
      id: 'chatcmpl-stream-123',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: { content: word + ' ' },
          finish_reason: null,
        },
      ],
    });
  }

  // Final chunk
  chunks.push({
    id: 'chatcmpl-stream-123',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  });

  return chunks;
}

/**
 * Creates streaming chunks for Anthropic
 */
export function createAnthropicStreamingEvents(content: string) {
  const words = content.split(' ');
  const events = [];

  // Message start event
  events.push({
    type: 'message_start',
    message: {
      id: 'msg_stream_123',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 0 },
    },
  });

  // Content block start
  events.push({
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  });

  // Content deltas
  for (const word of words) {
    events.push({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: word + ' ' },
    });
  }

  // Content block stop
  events.push({
    type: 'content_block_stop',
    index: 0,
  });

  // Message delta with final usage
  events.push({
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 25 },
  });

  // Message stop
  events.push({
    type: 'message_stop',
  });

  return events;
}

/**
 * Creates streaming chunks for Google Gemini
 */
export function createGoogleStreamingChunks(content: string) {
  const words = content.split(' ');
  const chunks = [];

  // Google streams complete candidates with incremental text
  let accumulatedText = '';
  for (const word of words) {
    accumulatedText += word + ' ';
    chunks.push({
      candidates: [
        {
          content: {
            parts: [{ text: accumulatedText }],
            role: 'model',
          },
          finishReason: null,
          index: 0,
          safetyRatings: [],
        },
      ],
      promptFeedback: {
        safetyRatings: [],
      },
    });
  }

  // Final chunk with finish reason
  chunks.push({
    candidates: [
      {
        content: {
          parts: [{ text: accumulatedText.trim() }],
          role: 'model',
        },
        finishReason: 'STOP',
        index: 0,
        safetyRatings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            probability: 'NEGLIGIBLE',
          },
        ],
      },
    ],
    usageMetadata: {
      promptTokenCount: 8,
      candidatesTokenCount: 15,
      totalTokenCount: 23,
    },
  });

  return chunks;
}

// ===== ERROR RESPONSE MOCKS =====

/**
 * Common error responses for all providers
 */
export const ERROR_RESPONSES = {
  openai: {
    rateLimit: {
      error: {
        message: 'Rate limit reached for requests',
        type: 'rate_limit_exceeded',
        param: null,
        code: 'rate_limit_exceeded',
      },
    },
    invalidApiKey: {
      error: {
        message: 'Incorrect API key provided',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key',
      },
    },
    modelNotFound: {
      error: {
        message: 'The model `gpt-5` does not exist',
        type: 'invalid_request_error',
        param: 'model',
        code: 'model_not_found',
      },
    },
    contextLengthExceeded: {
      error: {
        message: "This model's maximum context length is 4097 tokens",
        type: 'invalid_request_error',
        param: 'messages',
        code: 'context_length_exceeded',
      },
    },
  },

  anthropic: {
    rateLimit: {
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
      },
    },
    invalidApiKey: {
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Invalid API key',
      },
    },
    overloaded: {
      type: 'error',
      error: {
        type: 'overloaded_error',
        message: 'Anthropic API is temporarily overloaded',
      },
    },
    invalidRequest: {
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: 'messages: text content blocks must be non-empty',
      },
    },
  },

  google: {
    quotaExceeded: {
      error: {
        code: 429,
        message: 'Quota exceeded for quota metric',
        status: 'RESOURCE_EXHAUSTED',
      },
    },
    invalidApiKey: {
      error: {
        code: 403,
        message: 'API key not valid',
        status: 'PERMISSION_DENIED',
      },
    },
    invalidArgument: {
      error: {
        code: 400,
        message: 'Invalid argument provided',
        status: 'INVALID_ARGUMENT',
      },
    },
    modelNotFound: {
      error: {
        code: 404,
        message: 'Model not found',
        status: 'NOT_FOUND',
      },
    },
  },

  groq: {
    rateLimit: {
      error: {
        message: 'Rate limit exceeded. Please try again later.',
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
      },
    },
    modelBusy: {
      error: {
        message: 'Model is currently busy. Please try again.',
        type: 'model_busy',
        code: 'model_busy',
      },
    },
  },

  ollama: {
    modelNotFound: {
      error: 'model "llama3.1:latest" not found, try pulling it first',
    },
    connectionRefused: {
      error: 'connect ECONNREFUSED 127.0.0.1:11434',
    },
  },

  lmstudio: {
    serverNotRunning: {
      error: 'Cannot connect to LMStudio server at http://localhost:1234',
    },
    modelNotLoaded: {
      error: 'No model is currently loaded in LMStudio',
    },
  },
};

// ===== EDGE CASE MOCKS =====

/**
 * Edge cases that all providers should handle gracefully
 */
export const EDGE_CASE_RESPONSES = {
  emptyResponse: {
    openai: {
      id: 'chatcmpl-empty',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: '',
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
    },
    anthropic: {
      id: 'msg_empty',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 0 },
    },
    google: {
      candidates: [
        {
          content: {
            parts: [],
            role: 'model',
          },
          finishReason: 'STOP',
          index: 0,
        },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0, totalTokenCount: 10 },
    },
  },

  multipleToolCalls: {
    openai: {
      id: 'chatcmpl-multi-tools',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: "I'll help with multiple tasks.",
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'get_weather',
                  arguments: '{"location": "New York"}',
                },
              },
              {
                id: 'call_2',
                type: 'function',
                function: {
                  name: 'calculate',
                  arguments: '{"expression": "2+2"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
    },
    anthropic: {
      id: 'msg_multi_tools',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: "I'll help with multiple tasks.",
        },
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'get_weather',
          input: { location: 'New York' },
        },
        {
          type: 'tool_use',
          id: 'toolu_2',
          name: 'calculate',
          input: { expression: '2+2' },
        },
      ],
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 50, output_tokens: 30 },
    },
  },

  veryLongContent: {
    openai: createOpenAICompatibleTextResponse('A'.repeat(4000)),
    anthropic: {
      id: 'msg_long',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: 'A'.repeat(4000),
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 4000 },
    },
  },

  specialCharacters: {
    content:
      'Test with special chars: "quotes", \'apostrophes\', \\backslashes\\, \nnewlines\n, \ttabs\t, and emoji 🚀',
    openai: createOpenAICompatibleTextResponse(
      'Test with special chars: "quotes", \'apostrophes\', \\backslashes\\, \nnewlines\n, \ttabs\t, and emoji 🚀'
    ),
    anthropic: {
      id: 'msg_special',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-sonnet-20241022',
      content: [
        {
          type: 'text',
          text: 'Test with special chars: "quotes", \'apostrophes\', \\backslashes\\, \nnewlines\n, \ttabs\t, and emoji 🚀',
        },
      ],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 25 },
    },
  },
};

// ===== HELPER UTILITIES FOR TESTS =====

/**
 * Creates a consistent tool result across providers
 */
export function createToolResult(toolCallId: string, toolName: string, result: string) {
  return {
    openai: {
      role: 'tool' as const,
      tool_call_id: toolCallId,
      name: toolName,
      content: result,
    },
    anthropic: {
      type: 'tool_result' as const,
      tool_use_id: toolCallId,
      content: result,
    },
    google: {
      role: 'user' as const,
      parts: [
        {
          functionResponse: {
            name: toolName,
            response: {
              content: result,
            },
          },
        },
      ],
    },
  };
}

/**
 * Validates that a response matches expected structure
 */
export function validateProviderResponse(
  provider: string,
  response: any,
  expectedType: 'text' | 'tool' | 'error'
): boolean {
  switch (provider) {
    case 'openai':
    case 'groq':
    case 'ollama':
    case 'lmstudio':
      if (expectedType === 'error') return response.error !== undefined;
      return response.choices && response.choices[0]?.message !== undefined;

    case 'anthropic':
      if (expectedType === 'error') return response.error !== undefined;
      return response.content !== undefined && response.role === 'assistant';

    case 'google':
      if (expectedType === 'error') return response.error !== undefined;
      return response.candidates && response.candidates[0]?.content !== undefined;

    default:
      return false;
  }
}
