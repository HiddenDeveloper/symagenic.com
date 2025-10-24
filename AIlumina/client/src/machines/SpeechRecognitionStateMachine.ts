// SpeechRecognitionStateMachine.ts — XState v5 version

import { assign, createMachine } from "xstate";

export interface SpeechRecognitionContext {
  transcript: string;
  error?: Error;
}

export type SpeechRecognitionEvent =
  | { type: "INITIALIZE" }
  | { type: "INITIALIZED_SUCCESS" }
  | { type: "INITIALIZED_ERROR"; error: Error }
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING" }
  | { type: "SPEECH_DETECTED" }
  | { type: "SPEECH_END" }
  | { type: "PROCESS_RESULT" }
  | { type: "RESULT_READY"; transcript: string }
  | { type: "ERROR"; error: Error };

export const SpeechRecognitionStateMachine = createMachine({
  id: "speechRecognition",
  initial: "inactive",
  types: {} as {
    context: SpeechRecognitionContext;
    events: SpeechRecognitionEvent;
  },
  context: {
    transcript: "",
    error: undefined,
  },
  states: {
    inactive: {
      on: {
        INITIALIZE: "initializing",
      },
    },
    initializing: {
      on: {
        INITIALIZED_SUCCESS: "ready",
        INITIALIZED_ERROR: {
          target: "error",
          actions: assign({
            error: (_ctx, event) =>
              (event as unknown as { error: Error }).error,
          }),
        },
      },
    },
    ready: {
      on: {
        START_LISTENING: "listening",
        ERROR: {
          target: "error",
          actions: assign({
            error: (_ctx, event) =>
              (event as unknown as { error: Error }).error,
          }),
        },
      },
    },
    listening: {
      on: {
        SPEECH_DETECTED: {}, // stay in listening
        SPEECH_END: "processing",
        STOP_LISTENING: "ready",
      },
    },
    processing: {
      on: {
        RESULT_READY: {
          target: "ready",
          actions: assign({
            transcript: (_ctx, event) =>
              (event as unknown as { transcript: string }).transcript,
          }),
        },
        ERROR: {
          target: "error",
          actions: assign({
            error: (_ctx, event) =>
              (event as unknown as { error: Error }).error,
          }),
        },
      },
    },
    error: {
      on: {
        INITIALIZE: {
          target: "initializing",
          actions: assign({
            error: () => undefined,
            transcript: () => "",
          }),
        },
      },
    },
  },
});
