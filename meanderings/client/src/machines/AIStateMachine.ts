import { assign, createMachine } from "xstate";

export interface AIContext {
  prompt: string;
  response: string;
  error?: string;
}

export type AIEvent =
  | { type: "SEND_REQUEST"; input: string }
  | { type: "RECEIVE_SENTENCE"; content: string }
  | { type: "TOOL_EXECUTION_START" }
  | { type: "TOOL_EXECUTION_COMPLETE" }
  | { type: "RECEIVE_INTERACTION_COMPLETE" }
  | { type: "CLEAR" }
  | { type: "ERROR"; error: string };

export const AIStateMachine = createMachine({
  id: "ai",
  initial: "waiting",
  types: {} as {
    context: AIContext;
    events: AIEvent;
  },
  context: {
    prompt: "",
    response: "",
    error: undefined,
  },
  states: {
    waiting: {
      on: {
        SEND_REQUEST: {
          target: "processing",
          actions: assign({
            prompt: (_ctx, event) =>
              (event as unknown as { type: "SEND_REQUEST"; input: string })
                .input,
            response: () => "",
            error: () => undefined,
          }),
        },
      },
    },
    processing: {
      on: {
        RECEIVE_SENTENCE: {
          target: "responding",
          actions: assign({
            response: ({ event }) =>
              event?.type === "RECEIVE_SENTENCE" ? event.content : "",
          }),
        },
        ERROR: {
          target: "error",
          actions: assign({
            error: ({ event }) =>
              event?.type === "ERROR" ? event.error : "Unknown error",
          }),
        },
      },
    },
    responding: {
      on: {
        RECEIVE_INTERACTION_COMPLETE: "complete",
      },
    },
    complete: {
      on: {
        CLEAR: {
          target: "waiting",
          actions: assign({
            prompt: () => "",
            response: () => "",
            error: () => undefined,
          }),
        },
      },
    },
    error: {
      on: {
        CLEAR: "waiting",
      },
    },
  },
});
