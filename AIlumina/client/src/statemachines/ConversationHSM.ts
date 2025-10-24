// ConversationHSM.ts — Refactored for XState v5 with Independent SR/TTS Control
import { assign, createMachine } from "xstate";

// Define AI conversation states
export const AIState = {
  WAITING: "waiting",
  THINKING: "thinking",
  RESPONDING: "responding",
  ERROR: "error",
} as const;

// Define context type
export interface ConversationContext {
  // User inputs
  userInput: string; // The current user text input
  transcript: string; // Speech recognition transcript

  // AI responses
  aiResponse: string; // The current AI response
  error: string | null; // Any error that occurred

  // Input/Output mode flags (independent control)
  speechRecognitionEnabled: boolean; // Is speech input active?
  speechSynthesisEnabled: boolean; // Is voice output active?

  // Tool status
  currentTool: {
    name: string;
    startTime: number;
    isRunning: boolean;
    hasError: boolean;
    errorMessage?: string;
  } | null;

  // History
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
  }>;
}

// Define event types
export type ConversationEvent =
  | { type: "SUBMIT_TEXT"; input: string }
  | { type: "TOGGLE_SPEECH_RECOGNITION" } // Toggle speech input on/off
  | { type: "TOGGLE_SPEECH_SYNTHESIS" } // Toggle voice output on/off
  | { type: "AI_RESPONSE_RECEIVED"; response: string; message?: any }
  | { type: "AI_COMPLETE" }
  | { type: "AI_ERROR"; message: string }
  | { type: "SPEECH_RECOGNIZED"; text: string }
  | { type: "SPEECH_RECOGNITION_ERROR"; message: string }
  | { type: "TTS_COMPLETE" }
  | { type: "RESET_CONVERSATION" }
  | { type: "TOOL_STARTED"; tool: string }
  | { type: "TOOL_COMPLETED"; tool: string }
  | { type: "TOOL_ERROR"; tool: string; error: string }
  // Legacy events for backward compatibility (map to toggle events)
  | { type: "DISABLE_VOICE_MODE" }
  | { type: "ENABLE_VOICE_MODE" };

// Create the machine
export const ConversationMachine = createMachine(
  {
    id: "conversation",
    types: {} as {
      context: ConversationContext;
      events: ConversationEvent;
    },
    initial: AIState.WAITING,
    context: {
      userInput: "",
      transcript: "",
      aiResponse: "",
      error: null,
      speechRecognitionEnabled: false,
      speechSynthesisEnabled: false,
      currentTool: null,
      messages: [],
    },
    states: {
      [AIState.WAITING]: {
        on: {
          SUBMIT_TEXT: {
            target: AIState.THINKING,
            actions: [
              assign({
                userInput: ({ event }) => event.input,
                error: null,
              }),
              "addUserMessage",
            ],
          },
        },
      },
      [AIState.THINKING]: {
        on: {
          AI_RESPONSE_RECEIVED: {
            target: AIState.RESPONDING,
            actions: [
              assign({
                aiResponse: ({ event }) => event.response,
                error: null,
              }),
              "addAIMessage",
            ],
          },
          AI_ERROR: {
            target: AIState.ERROR,
            actions: assign({
              error: ({ event }) => event.message,
            }),
          },
        },
      },
      [AIState.RESPONDING]: {
        on: {
          SUBMIT_TEXT: {
            target: AIState.THINKING,
            actions: [
              assign({
                userInput: ({ event }) => event.input,
                error: null,
              }),
              "addUserMessage",
            ],
          },
          AI_RESPONSE_RECEIVED: {
            actions: [
              assign({
                aiResponse: ({ event }) => event.response,
                error: null,
              }),
              "addAIMessage",
            ],
          },
          AI_COMPLETE: AIState.WAITING,
        },
      },
      [AIState.ERROR]: {
        on: {
          SUBMIT_TEXT: {
            target: AIState.THINKING,
            actions: [
              assign({
                userInput: ({ event }) => event.input,
                error: null,
              }),
              "addUserMessage",
            ],
          },
        },
      },
    },
    on: {
      // Toggle speech recognition on/off
      TOGGLE_SPEECH_RECOGNITION: {
        actions: assign({
          speechRecognitionEnabled: ({ context }) =>
            !context.speechRecognitionEnabled,
        }),
      },
      // Toggle speech synthesis on/off
      TOGGLE_SPEECH_SYNTHESIS: {
        actions: assign({
          speechSynthesisEnabled: ({ context }) =>
            !context.speechSynthesisEnabled,
        }),
      },
      // Legacy voice mode events (enable both SR and TTS)
      ENABLE_VOICE_MODE: {
        actions: assign({
          speechRecognitionEnabled: true,
          speechSynthesisEnabled: true,
        }),
      },
      DISABLE_VOICE_MODE: {
        actions: assign({
          speechRecognitionEnabled: false,
          speechSynthesisEnabled: false,
        }),
      },
      TOOL_STARTED: {
        actions: assign({
          currentTool: ({ event }) => {
            if (event.type !== "TOOL_STARTED") return null;
            return {
              name: event.tool,
              startTime: Date.now(),
              isRunning: true,
              hasError: false,
            };
          },
        }),
      },
      TOOL_COMPLETED: {
        actions: assign({
          currentTool: ({ context, event }) => {
            if (event.type !== "TOOL_COMPLETED") return context.currentTool;
            if (context.currentTool?.name === event.tool) return null;
            return context.currentTool;
          },
        }),
      },
      TOOL_ERROR: {
        actions: assign({
          currentTool: ({ context, event }) => {
            if (event.type !== "TOOL_ERROR") return context.currentTool;
            if (context.currentTool?.name === event.tool) {
              return {
                ...context.currentTool,
                isRunning: false,
                hasError: true,
                errorMessage: event.error,
              };
            }
            return context.currentTool;
          },
        }),
      },
      RESET_CONVERSATION: {
        actions: assign({
          userInput: "",
          transcript: "",
          aiResponse: "",
          error: null,
          speechRecognitionEnabled: false,
          speechSynthesisEnabled: false,
          currentTool: null,
          messages: [],
        }),
      },
    },
  },
  {
    actions: {
      addUserMessage: assign({
        messages: ({ context, event }) => {
          if (event.type !== "SUBMIT_TEXT") return context.messages;

          // Don't add empty messages (used just for state transitions)
          if (!event.input || event.input.trim() === "") {
            console.log("[ConversationHSM] Skipping empty user message");
            return context.messages;
          }

          console.log("[ConversationHSM] Adding user message:", event.input);

          const userMessage = {
            id: `user-${Date.now()}`,
            role: "user" as const,
            content: event.input,
          };

          return [...context.messages, userMessage];
        },
      }),

      addAIMessage: assign({
        messages: ({ context, event }) => {
          console.log(
            "[ConversationHSM] addAIMessage called with event:",
            event,
          );
          if (event.type !== "AI_RESPONSE_RECEIVED") {
            console.log(
              "[ConversationHSM] Event type not AI_RESPONSE_RECEIVED, returning",
            );
            return context.messages;
          }

          console.log("[ConversationHSM] Adding AI message:", event.message);
          console.log("[ConversationHSM] Current messages:", context.messages);

          if (!event.message) {
            console.warn(
              "[ConversationHSM] No message object in AI_RESPONSE_RECEIVED event",
            );
            return context.messages;
          }

          const newMessages = [...context.messages, event.message];
          console.log("[ConversationHSM] New messages array:", newMessages);
          return newMessages;
        },
      }),
    },
  },
);
