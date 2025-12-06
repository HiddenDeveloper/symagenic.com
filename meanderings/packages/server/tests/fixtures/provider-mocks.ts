/**
 * Provider Response Mock Functions
 *
 * These functions create accurate mock responses for each AI provider based on their
 * official API documentation. Used for testing provider message format handling.
 */

// ===== ANTHROPIC PROVIDER MOCKS =====

/**
 * Creates a mock Anthropic text response
 */
export function createAnthropicTextResponse(content: string) {
  return {
    id: 'msg_01Aq9w938a90dw8q',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-20250514',
    content: [
      {
        type: 'text',
        text: content,
      },
    ],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 12,
      output_tokens: 25,
    },
  };
}

/**
 * Creates a mock Anthropic tool use response
 */
export function createAnthropicToolUseResponse(toolName: string, input: Record<string, any>) {
  return {
    id: 'msg_01Aq9w938a90dw8q',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-20250514',
    content: [
      {
        type: 'text',
        text: "I'll help you with that. Let me use the appropriate tool.",
      },
      {
        type: 'tool_use',
        id: 'toolu_01A09q90qw90lq917835lq9',
        name: toolName,
        input: input,
      },
    ],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: {
      input_tokens: 472,
      output_tokens: 95,
    },
  };
}

// ===== OPENAI PROVIDER MOCKS =====

/**
 * Creates a mock OpenAI text response
 */
export function createOpenAITextResponse(content: string) {
  return {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1677652288,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 9,
      completion_tokens: 12,
      total_tokens: 21,
    },
  };
}

/**
 * Creates a mock OpenAI tool call response
 */
export function createOpenAIToolCallResponse(toolName: string, args: Record<string, any>) {
  return {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1677652288,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: "I'll help you with that using the appropriate tool.",
          tool_calls: [
            {
              id: 'call_xxxxxxxxxxxxxx',
              type: 'function',
              function: {
                name: toolName,
                arguments: JSON.stringify(args),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: {
      prompt_tokens: 82,
      completion_tokens: 18,
      total_tokens: 100,
    },
  };
}

// ===== GOOGLE GEMINI PROVIDER MOCKS =====

/**
 * Creates a mock Google text response
 */
export function createGoogleTextResponse(content: string) {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: content,
            },
          ],
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
  };
}

/**
 * Creates a mock Google function call response
 */
export function createGoogleFunctionCallResponse(functionName: string, args: Record<string, any>) {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: "I'll help you with that. Let me call the appropriate function.",
            },
            {
              functionCall: {
                name: functionName,
                args: args,
              },
            },
          ],
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
      promptTokenCount: 50,
      candidatesTokenCount: 25,
      totalTokenCount: 75,
    },
  };
}

// ===== COMMON TEST SCENARIOS =====

/**
 * Sample tool definitions for testing
 */
export const SAMPLE_TOOLS = {
  weather: {
    name: 'get_weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City and state, e.g. San Francisco, CA',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperature unit',
        },
      },
      required: ['location'],
    },
  },
  calculator: {
    name: 'calculate',
    description: 'Perform mathematical calculations',
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
  },
};

/**
 * Sample test data for function calls
 */
export const SAMPLE_FUNCTION_CALLS = {
  weather: {
    location: 'San Francisco, CA',
    unit: 'celsius',
  },
  calculator: {
    expression: '2 + 2 * 3',
  },
};

/**
 * Sample function results
 */
export const SAMPLE_FUNCTION_RESULTS = {
  weather: 'The weather in San Francisco, CA is 22°C with partly cloudy skies.',
  calculator: '8',
};
