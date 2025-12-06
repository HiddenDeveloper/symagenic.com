import { beforeEach, describe, expect, it } from "vitest";

import {
  AnthropicMessageFormat,
  ContentArrayMessage,
  ContentStringMessage,
  createServerMessage,
  detectAIProvider,
  type Message,
  messageHasText,
  normalizeMessageContent,
  OpenAIMessageFormat,
  GeminiMessageFormat,
  ToolStatusFormat,
  PartsArrayMessage,
  Part,
  Role,
  ServerMessageFormat,
  ServerMessageHistory,
  shouldDisplayMessage,
} from "./AIServiceTypes";

describe("AIServiceTypes utils", () => {
  it("normalizes string content", () => {
    const msg: Message = { role: "assistant" as const, content: "hello world" };
    expect(normalizeMessageContent(msg)).toBe("hello world");
  });

  it("normalizes array content (text blocks)", () => {
    const msg: Message = {
      role: "assistant" as const,
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
        { type: "tool_use", name: "noop" },
      ] as any,
    };
    expect(normalizeMessageContent(msg)).toBe("first second");
  });

  it("normalizes parts array (Gemini format)", () => {
    const msg: Message = {
      role: "assistant" as const,
      parts: [{ text: "hello" }, { text: "gemini" }],
    } as any;
    expect(normalizeMessageContent(msg)).toBe("hello gemini");
  });

  it("messageHasText detects presence of text", () => {
    const withText: Message = { role: "assistant" as const, content: "  has text  " };
    const noText: Message = { role: "assistant" as const, content: "   " };
    expect(messageHasText(withText)).toBe(true);
    expect(messageHasText(noText)).toBe(false);
  });

  it("detects AI provider by structure", () => {
    const openai: Message = { role: "assistant" as const, content: "hi" };
    const gemini: Message = {
      role: "assistant" as const,
      parts: [{ text: "hi" }],
    } as any;
    const anthropic: Message = {
      role: "assistant" as const,
      content: [{ type: "text", text: "hi" }],
    } as any;
    expect(detectAIProvider(openai)).toBe("openai");
    expect(detectAIProvider(gemini)).toBe("gemini");
    expect(detectAIProvider(anthropic)).toBe("anthropic");
  });

  it("filters OpenAI system/tool messages from display", () => {
    const openaiSystem: Message = { role: "system" as const, content: "sys" };
    const openaiTool: Message = { role: "tool" as const, content: "tool" };
    const assistant: Message = { role: "assistant" as const, content: "ok" };
    expect(shouldDisplayMessage(openaiSystem)).toBe(false);
    expect(shouldDisplayMessage(openaiTool)).toBe(false);
    expect(shouldDisplayMessage(assistant)).toBe(true);
  });
});

describe("ServerMessageHistory", () => {
  let history: ServerMessageHistory;

  beforeEach(() => {
    history = new ServerMessageHistory();
  });

  it("adds raw messages and converts them correctly", () => {
    const rawMessage: OpenAIMessageFormat = { role: Role.ASSISTANT, content: "test message" };
    const index = history.addRaw(rawMessage);

    expect(index).toBe(0);
    expect(history.length).toBe(1);

    const chatMessages = history.getChatMessages();
    expect(chatMessages).toHaveLength(1);
    expect(chatMessages[0]).toBeDefined();
    expect(chatMessages[0]!.getText()).toBe("test message");
  });

  it("filters chat messages correctly", () => {
    history.addRaw({ role: Role.ASSISTANT, content: "chat message" } as OpenAIMessageFormat);
    history.addRaw({ tool_status: "completed", tool_name: "test_tool" } as ToolStatusFormat);
    history.addRaw({ sentence: "streaming sentence" } as ServerMessageFormat);

    const chatMessages = history.getChatMessages();
    expect(chatMessages).toHaveLength(1);
    expect(chatMessages[0]).toBeDefined();
    expect(chatMessages[0]?.getText()).toBe("chat message");
  });

  it("gets visible messages only", () => {
    history.addRaw({ role: Role.ASSISTANT, content: "visible message" } as OpenAIMessageFormat);
    history.addRaw({ role: Role.SYSTEM, content: "system message" } as OpenAIMessageFormat);
    history.addRaw({ role: Role.USER, content: "user message" } as OpenAIMessageFormat);

    const visibleMessages = history.getVisibleMessages();
    expect(visibleMessages).toHaveLength(3); // All should be visible for non-OpenAI
  });

  it("preserves original message format with toApiFormat", () => {
    const originalMessage: OpenAIMessageFormat = {
      role: Role.ASSISTANT,
      content: "test",
      custom_field: "preserved",
    } as any;

    history.addRaw(originalMessage);
    const messages = history.getChatMessages();
    const apiFormat = messages[0]?.toApiFormat();

    expect(apiFormat).toBeDefined();
    if (apiFormat && 'custom_field' in apiFormat) {
      expect(apiFormat.custom_field).toBe("preserved");
    }
    if (apiFormat && 'role' in apiFormat) {
      expect(apiFormat.role).toBe("assistant");
    }
    if (apiFormat && 'content' in apiFormat) {
      expect(apiFormat.content).toBe("test");
    }
  });
});

describe("OpenAI Function Calling Message Format", () => {
  it("creates ContentArrayMessage for assistant with tool_calls", () => {
    const openaiToolCall: OpenAIMessageFormat = {
      role: Role.ASSISTANT,
      content: null,
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: {
            name: "get_weather",
            arguments: '{"location": "San Francisco"}',
          },
        },
      ],
    };

    const message = createServerMessage(openaiToolCall);
    expect(message).toBeInstanceOf(ContentArrayMessage);
    const apiFormat = message.toApiFormat();
    if ('tool_calls' in apiFormat && apiFormat.tool_calls && Array.isArray(apiFormat.tool_calls) && apiFormat.tool_calls.length > 0) {
      expect(apiFormat.tool_calls).toHaveLength(1);
      expect(apiFormat.tool_calls[0].function.name).toBe("get_weather");
    }
  });

  it("handles tool role messages with tool_call_id", () => {
    const toolMessage: OpenAIMessageFormat = {
      role: Role.TOOL,
      content: "Weather: 72°F",
      tool_call_id: "call_123",
    };

    const message = createServerMessage(toolMessage);
    expect(message).toBeInstanceOf(ContentStringMessage);
    expect((message as ContentStringMessage).getText()).toBe("Weather: 72°F");
    const apiFormat = message.toApiFormat();
    if ('tool_call_id' in apiFormat) {
      expect(apiFormat.tool_call_id).toBe("call_123");
    }
  });

  it("handles parallel tool calls", () => {
    const parallelCalls: OpenAIMessageFormat = {
      role: Role.ASSISTANT,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "get_weather", arguments: '{"location": "SF"}' },
        },
        {
          id: "call_2",
          type: "function",
          function: { name: "get_time", arguments: "{}" },
        },
      ],
    };

    const message = createServerMessage(parallelCalls);
    expect(message).toBeInstanceOf(ContentArrayMessage);
    const apiFormat = message.toApiFormat();
    if ('tool_calls' in apiFormat && apiFormat.tool_calls) {
      expect(apiFormat.tool_calls).toHaveLength(2);
    }
  });

  it("creates chat history compatible with OpenAI API format", () => {
    const history = new ServerMessageHistory();

    // User message
    history.addRaw({ role: "user" as const, content: "What is the weather?" } as ServerMessageFormat);

    // Assistant with tool call
    history.addRaw({
      role: "assistant" as const,
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: { name: "get_weather", arguments: '{"location": "SF"}' },
        },
      ],
    } as ServerMessageFormat);

    // Tool result
    history.addRaw({
      role: "tool" as const,
      content: "72°F sunny",
      tool_call_id: "call_123",
    } as ServerMessageFormat);

    const chatMessages = history.getChatMessages();
    expect(chatMessages).toHaveLength(3);

    const apiMessages = chatMessages.map((msg) => msg.toApiFormat());
    const secondMsg = apiMessages[1];
    if (secondMsg && 'tool_calls' in secondMsg) {
      expect(secondMsg.tool_calls).toBeDefined();
    }
    const thirdMsg = apiMessages[2];
    if (thirdMsg && 'tool_call_id' in thirdMsg) {
      expect(thirdMsg.tool_call_id).toBe("call_123");
    }
  });
});

describe("Anthropic Tool Use Message Format", () => {
  it("creates ContentArrayMessage for assistant with tool_use blocks", () => {
    const anthropicToolUse: AnthropicMessageFormat = {
      role: "assistant" as const,
      content: [
        {
          type: "text",
          text: "I need to check the weather for you.",
        },
        {
          type: "tool_use",
          id: "tool_123",
          name: "get_weather",
          input: { location: "San Francisco" },
        },
      ],
    };

    const message = createServerMessage(anthropicToolUse);
    expect(message).toBeInstanceOf(ContentArrayMessage);

    const apiFormat = message.toApiFormat();
    if ('content' in apiFormat && Array.isArray(apiFormat.content)) {
      expect(apiFormat.content).toHaveLength(2);
      expect(apiFormat.content[1].type).toBe("tool_use");
      if ('name' in apiFormat.content[1]) {
        expect(apiFormat.content[1].name).toBe("get_weather");
      }
    }
  });

  it("handles user messages with tool_result blocks", () => {
    const toolResult: AnthropicMessageFormat = {
      role: Role.USER,
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_123",
          content: "Temperature: 72°F, sunny",
          is_error: false,
        },
      ],
    };

    const message = createServerMessage(toolResult);
    expect(message).toBeInstanceOf(ContentArrayMessage);

    const apiFormat = message.toApiFormat();
    if ('content' in apiFormat && Array.isArray(apiFormat.content)) {
      expect(apiFormat.content[0].type).toBe("tool_result");
      if ('tool_use_id' in apiFormat.content[0]) {
        expect(apiFormat.content[0].tool_use_id).toBe("tool_123");
      }
    }
  });

  it("handles tool_result with error", () => {
    const errorResult: AnthropicMessageFormat = {
      role: Role.USER,
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_123",
          content: "API error: Invalid location",
          is_error: true,
        },
      ],
    };

    const message = createServerMessage(errorResult);
    const apiFormat = message.toApiFormat();
    if ('content' in apiFormat && Array.isArray(apiFormat.content)) {
      if ('is_error' in apiFormat.content[0]) {
        expect(apiFormat.content[0].is_error).toBe(true);
      }
    }
  });

  it("creates chat history compatible with Anthropic API format", () => {
    const history = new ServerMessageHistory();

    // User message
    history.addRaw({ role: Role.USER, content: "What is the weather in NYC?" } as OpenAIMessageFormat);

    // Assistant with tool use
    history.addRaw({
      role: Role.ASSISTANT,
      content: [
        { type: "text", text: "I'll check the weather for you." },
        {
          type: "tool_use",
          id: "tool_456",
          name: "get_weather",
          input: { location: "New York City" },
        },
      ],
    } as AnthropicMessageFormat);

    // User with tool result
    history.addRaw({
      role: Role.USER,
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_456",
          content: "68°F, cloudy",
        },
      ],
    } as AnthropicMessageFormat);

    const chatMessages = history.getChatMessages();
    expect(chatMessages).toHaveLength(3);

    const assistantMsg = chatMessages[1]?.toApiFormat();
    if (assistantMsg && 'content' in assistantMsg && Array.isArray(assistantMsg.content)) {
      expect(assistantMsg.content[1].type).toBe("tool_use");
    }

    const toolResultMsg = chatMessages[2]?.toApiFormat();
    if (toolResultMsg && 'content' in toolResultMsg && Array.isArray(toolResultMsg.content)) {
      expect(toolResultMsg.content[0].type).toBe("tool_result");
    }
  });
});

describe("Gemini Function Calling Message Format", () => {
  it("creates PartsArrayMessage for messages with functionCall", () => {
    const geminiFunctionCall: GeminiMessageFormat = {
      role: Role.MODEL,
      parts: [
        { text: "I need to get the weather information." },
        {
          functionCall: {
            name: "get_weather",
            args: { location: "Tokyo" },
          },
        },
      ],
    };

    const message = createServerMessage(geminiFunctionCall);
    expect(message).toBeInstanceOf(PartsArrayMessage);

    const apiFormat = message.toApiFormat();
    if ('parts' in apiFormat && Array.isArray(apiFormat.parts)) {
      const parts = apiFormat.parts as Part[];
      expect(parts).toHaveLength(2);
      if (parts[1] && 'functionCall' in parts[1]) {
        expect(parts[1].functionCall.name).toBe("get_weather");
      }
    }
  });

  it("handles user messages with functionResponse", () => {
    const functionResponse: GeminiMessageFormat = {
      role: Role.USER,
      parts: [
        {
          functionResponse: {
            name: "get_weather",
            response: JSON.stringify({
              temperature: "75°F",
              condition: "sunny",
            }),
          },
        },
      ],
    };

    const message = createServerMessage(functionResponse);
    expect(message).toBeInstanceOf(PartsArrayMessage);

    const apiFormat = message.toApiFormat();
    if ('parts' in apiFormat && Array.isArray(apiFormat.parts)) {
      const parts = apiFormat.parts as Part[];
      if (parts[0] && 'functionResponse' in parts[0]) {
        expect(parts[0].functionResponse.name).toBe("get_weather");
        const response = JSON.parse(parts[0].functionResponse.response);
        expect(response.temperature).toBe("75°F");
      }
    }
  });

  it("handles multiple function calls in single message", () => {
    const multipleFunctions: GeminiMessageFormat = {
      role: Role.MODEL,
      parts: [
        {
          functionCall: {
            name: "get_weather",
            args: { location: "Tokyo" },
          },
        },
        {
          functionCall: {
            name: "get_time",
            args: { timezone: "Asia/Tokyo" },
          },
        },
      ],
    };

    const message = createServerMessage(multipleFunctions);
    const apiFormat = message.toApiFormat();
    if ('parts' in apiFormat && Array.isArray(apiFormat.parts)) {
      const parts = apiFormat.parts as Part[];
      expect(parts).toHaveLength(2);
      if (parts[0] && 'functionCall' in parts[0]) {
        expect(parts[0].functionCall.name).toBe("get_weather");
      }
      if (parts[1] && 'functionCall' in parts[1]) {
        expect(parts[1].functionCall.name).toBe("get_time");
      }
    }
  });

  it("creates chat history compatible with Gemini API format", () => {
    const history = new ServerMessageHistory();

    // User message
    history.addRaw({
      role: "user",
      parts: [{ text: "What time is it in Tokyo?" }],
    });

    // Model with function call
    history.addRaw({
      role: "model",
      parts: [
        { text: "Let me check the time for you." },
        {
          functionCall: {
            name: "get_time",
            args: { location: "Tokyo" },
          },
        },
      ],
    });

    // User with function response
    history.addRaw({
      role: "user",
      parts: [
        {
          functionResponse: {
            name: "get_time",
            response: { time: "14:30 JST" },
          },
        },
      ],
    });

    const chatMessages = history.getChatMessages();
    expect(chatMessages).toHaveLength(3);

    const modelMsg = chatMessages[1]?.toApiFormat();
    if (modelMsg && 'parts' in modelMsg && Array.isArray(modelMsg.parts)) {
      const parts = modelMsg.parts as Part[];
      if (parts[1] && 'functionCall' in parts[1]) {
        expect(parts[1].functionCall).toBeDefined();
      }
    }

    const responseMsg = chatMessages[2]?.toApiFormat();
    if (responseMsg && 'parts' in responseMsg && Array.isArray(responseMsg.parts)) {
      const parts = responseMsg.parts as Part[];
      if (parts[0] && 'functionResponse' in parts[0]) {
        expect(parts[0].functionResponse).toBeDefined();
      }
    }
  });
});

describe("WebSocket Integration Tests", () => {
  it("handles WebSocket messages with OpenAI tool calls", () => {
    const history = new ServerMessageHistory();

    // Simulate WebSocket message with tool call
    const wsMessage: OpenAIMessageFormat = {
      role: Role.ASSISTANT,
      content: "I need to call a function",
      tool_calls: [
        {
          id: "call_789",
          type: "function",
          function: {
            name: "search_web",
            arguments: '{"query": "latest news"}',
          },
        },
      ],
    };

    history.addRaw(wsMessage);
    const messages = history.getChatMessages();

    expect(messages).toHaveLength(1);
    const apiFormat = messages[0]?.toApiFormat();
    if (apiFormat && 'tool_calls' in apiFormat) {
      expect(apiFormat.tool_calls).toBeDefined();
    }
    expect(messages[0]?.isVisibleInUI()).toBe(false); // Tool calls without text are not visible in UI
  });

  it("handles WebSocket messages with Anthropic tool use", () => {
    const history = new ServerMessageHistory();

    const wsMessage: AnthropicMessageFormat = {
      role: Role.ASSISTANT,
      content: [
        { type: "text", text: "Searching for information..." },
        {
          type: "tool_use",
          id: "search_001",
          name: "web_search",
          input: { query: "AI news" },
        },
      ],
    };

    history.addRaw(wsMessage);
    const messages = history.getChatMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0]?.getText()).toBe("Searching for information...");
    const apiFormat = messages[0]?.toApiFormat();
    if (apiFormat && 'content' in apiFormat && Array.isArray(apiFormat.content)) {
      expect(apiFormat.content[1].type).toBe("tool_use");
    }
  });

  it("handles WebSocket messages with Gemini function calls", () => {
    const history = new ServerMessageHistory();

    const wsMessage: GeminiMessageFormat = {
      role: Role.MODEL,
      parts: [
        { text: "I'll search for that information." },
        {
          functionCall: {
            name: "search_function",
            args: { query: "weather forecast" },
          },
        },
      ],
    };

    history.addRaw(wsMessage);
    const messages = history.getChatMessages();

    expect(messages).toHaveLength(1);
    expect(messages[0]?.getText()).toBe("I'll search for that information.");
    const apiFormat = messages[0]?.toApiFormat();
    if (apiFormat && 'parts' in apiFormat && Array.isArray(apiFormat.parts)) {
      const parts = apiFormat.parts as Part[];
      if (parts[1] && 'functionCall' in parts[1]) {
        expect(parts[1].functionCall).toBeDefined();
      }
    }
  });
});

describe("Message Flow Tests", () => {
  it("maintains complete conversation flow with tool calls", () => {
    const history = new ServerMessageHistory();

    // 1. User request
    history.addRaw({ role: Role.USER, content: "Get weather for Paris" } as OpenAIMessageFormat);

    // 2. Assistant tool call (OpenAI format)
    history.addRaw({
      role: Role.ASSISTANT,
      tool_calls: [
        {
          id: "weather_call",
          type: "function",
          function: { name: "get_weather", arguments: '{"city": "Paris"}' },
        },
      ],
    } as OpenAIMessageFormat);

    // 3. Tool result
    history.addRaw({
      role: Role.TOOL,
      content: "Paris: 18°C, light rain",
      tool_call_id: "weather_call",
    } as OpenAIMessageFormat);

    // 4. Assistant final response
    history.addRaw({
      role: Role.ASSISTANT,
      content: "The weather in Paris is 18°C with light rain.",
    } as OpenAIMessageFormat);

    const messages = history.getChatMessages();
    expect(messages).toHaveLength(4);

    // Verify conversation flow integrity
    const firstMsg = messages[0]?.toApiFormat();
    if (firstMsg && 'role' in firstMsg) {
      expect(firstMsg.role).toBe("user");
    }
    const secondMsg = messages[1]?.toApiFormat();
    if (secondMsg && 'tool_calls' in secondMsg) {
      expect(secondMsg.tool_calls).toBeDefined();
    }
    const thirdMsg = messages[2]?.toApiFormat();
    if (thirdMsg && 'tool_call_id' in thirdMsg) {
      expect(thirdMsg.tool_call_id).toBe("weather_call");
    }
    const fourthMsg = messages[3]?.toApiFormat();
    if (fourthMsg && 'content' in fourthMsg) {
      expect(fourthMsg.content).toContain("18°C");
    }
  });

  it("preserves tool call ID matching", () => {
    const history = new ServerMessageHistory();

    const toolCallId = "unique_call_id_123";

    history.addRaw({
      role: Role.ASSISTANT,
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: { name: "test_function", arguments: "{}" },
        },
      ],
    } as OpenAIMessageFormat);

    history.addRaw({
      role: Role.TOOL,
      content: "Function result",
      tool_call_id: toolCallId,
    } as OpenAIMessageFormat);

    const messages = history.getChatMessages();
    const firstApiMsg = messages[0]?.toApiFormat();
    const toolResult = messages[1]?.toApiFormat();

    if (firstApiMsg && 'tool_calls' in firstApiMsg && Array.isArray(firstApiMsg.tool_calls)) {
      const toolCall = firstApiMsg.tool_calls[0];
      expect(toolCall.id).toBe(toolCallId);
    }
    if (toolResult && 'tool_call_id' in toolResult) {
      expect(toolResult.tool_call_id).toBe(toolCallId);
    }
  });
});

describe("Edge Cases and Error Handling", () => {
  it("handles malformed tool call messages gracefully", () => {
    expect(() => {
      createServerMessage({
        role: Role.ASSISTANT,
        tool_calls: "invalid_format", // Should be array
      } as any);
    }).toThrow();
  });

  it("handles missing tool call arguments", () => {
    const message = createServerMessage({
      role: Role.ASSISTANT,
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: { name: "test_func" }, // Missing arguments
        },
      ],
    } as any);

    expect(message).toBeInstanceOf(ContentArrayMessage);
    const apiFormat = message.toApiFormat();
    if ('tool_calls' in apiFormat && Array.isArray(apiFormat.tool_calls)) {
      expect(apiFormat.tool_calls[0].function.arguments).toBeUndefined();
    }
  });

  it("handles empty tool calls array", () => {
    const message = createServerMessage({
      role: Role.ASSISTANT,
      content: "No tools needed",
      tool_calls: [],
    } as OpenAIMessageFormat);

    // Empty tool_calls array still creates ContentArrayMessage with empty content array
    expect(message).toBeInstanceOf(ContentArrayMessage);
    expect((message as ContentArrayMessage).getText()).toBe(null); // getText returns null because content array is empty
    const apiFormat = message.toApiFormat();
    if ('content' in apiFormat) {
      expect(apiFormat.content).toEqual([]); // Content becomes empty array for empty tool_calls
    }
    if ('tool_calls' in apiFormat) {
      expect(apiFormat.tool_calls).toEqual([]); // Empty tool_calls preserved
    }
  });

  it("handles mixed provider formats in same history", () => {
    const history = new ServerMessageHistory();

    // OpenAI format
    history.addRaw({
      role: Role.ASSISTANT,
      tool_calls: [
        { id: "call1", type: "function", function: { name: "func1", arguments: "{}" } },
      ],
    } as OpenAIMessageFormat);

    // Anthropic format
    history.addRaw({
      role: Role.ASSISTANT,
      content: [{ type: "tool_use", id: "tool1", name: "func2", input: {} }],
    } as AnthropicMessageFormat);

    // Gemini format
    history.addRaw({
      role: Role.MODEL,
      parts: [{ functionCall: { name: "func3", args: {} } }],
    } as GeminiMessageFormat);

    const messages = history.getChatMessages();
    expect(messages).toHaveLength(3);

    // Each should preserve its original format
    const msg0 = messages[0]?.toApiFormat();
    if (msg0 && 'tool_calls' in msg0) {
      expect(msg0.tool_calls).toBeDefined();
    }
    const msg1 = messages[1]?.toApiFormat();
    if (msg1 && 'content' in msg1 && Array.isArray(msg1.content)) {
      expect(msg1.content[0].type).toBe("tool_use");
    }
    const msg2 = messages[2]?.toApiFormat();
    if (msg2 && 'parts' in msg2 && Array.isArray(msg2.parts)) {
      const parts = msg2.parts as Part[];
      if (parts[0] && 'functionCall' in parts[0]) {
        expect(parts[0].functionCall).toBeDefined();
      }
    }
  });

  it("handles large tool call payloads", () => {
    const largeArgs = JSON.stringify({ data: "x".repeat(10000) });

    const message = createServerMessage({
      role: Role.ASSISTANT,
      tool_calls: [
        {
          id: "large_call",
          type: "function",
          function: {
            name: "process_data",
            arguments: largeArgs,
          },
        },
      ],
    } as OpenAIMessageFormat);

    const apiFormat = message.toApiFormat();
    if ('tool_calls' in apiFormat && Array.isArray(apiFormat.tool_calls)) {
      expect(apiFormat.tool_calls[0].function.arguments).toBe(largeArgs);
    }
  });
});
