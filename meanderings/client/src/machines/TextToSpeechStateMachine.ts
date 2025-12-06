// TextToSpeechStateMachine.ts — XState v5 version

import { assign, createMachine } from "xstate";

export interface TextToSpeechContext {
  text: string;
  error?: Error;
}

export type TTSEvent =
  | { type: "INITIALIZE" }
  | { type: "INITIALIZED_SUCCESS" }
  | { type: "INITIALIZED_ERROR"; error: Error }
  | { type: "PREPARE_SPEECH"; text: string }
  | { type: "SPEECH_READY" }
  | { type: "START_SPEAKING" }
  | { type: "PAUSE_SPEAKING" }
  | { type: "RESUME_SPEAKING" }
  | { type: "STOP_SPEAKING" }
  | { type: "SPEECH_ENDED" }
  | { type: "ERROR"; error: Error };

export const TextToSpeechStateMachine = createMachine({
  id: "tts",
  initial: "inactive",
  types: {} as {
    context: TextToSpeechContext;
    events: TTSEvent;
  },
  context: {
    text: "",
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
        PREPARE_SPEECH: {
          target: "preparing",
          actions: assign({
            text: (_ctx, event) => {
              const e = event as any;
              return typeof e?.text === "string" ? e.text : "";
            },
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
    preparing: {
      on: {
        SPEECH_READY: "speaking",
        ERROR: {
          target: "error",
          actions: assign({
            error: (_ctx, event) =>
              (event as unknown as { error: Error }).error,
          }),
        },
      },
    },
    speaking: {
      on: {
        PAUSE_SPEAKING: "speaking",
        RESUME_SPEAKING: "speaking",
        STOP_SPEAKING: "ready",
        SPEECH_ENDED: "ready",
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
            text: () => "",
          }),
        },
      },
    },
  },
});
