export const WS_STATES = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR",
  RETRYING: "RETRYING",
} as const;

export const WS_EVENTS = {
  CONNECT: "CONNECT",
  CONNECT_SUCCESS: "CONNECT_SUCCESS",
  CONNECT_FAILURE: "CONNECT_FAILURE",
  SOCKET_ERROR: "SOCKET_ERROR",
  DISCONNECT: "DISCONNECT",
  RETRY: "RETRY_TIMEOUT_EXPIRED",
} as const;

export type WebSocketState = (typeof WS_STATES)[keyof typeof WS_STATES];
export type WebSocketEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export type WebSocketEvent =
  | { type: typeof WS_EVENTS.CONNECT }
  | { type: typeof WS_EVENTS.CONNECT_SUCCESS }
  | { type: typeof WS_EVENTS.CONNECT_FAILURE; error: Error }
  | { type: typeof WS_EVENTS.SOCKET_ERROR; error: Error }
  | { type: typeof WS_EVENTS.DISCONNECT }
  | { type: typeof WS_EVENTS.RETRY };

export interface WebSocketReducerState {
  state: WebSocketState;
  error?: Error;
  retryCount: number;
  lastConnectedAt?: number;
}

export const initialWebSocketState: WebSocketReducerState = {
  state: WS_STATES.DISCONNECTED,
  retryCount: 0,
};

export function webSocketReducer(
  state: WebSocketReducerState = initialWebSocketState,
  event: WebSocketEvent,
): WebSocketReducerState {
  switch (event.type) {
    case WS_EVENTS.CONNECT:
      return { ...state, state: WS_STATES.CONNECTING };

    case WS_EVENTS.CONNECT_SUCCESS:
      return {
        state: WS_STATES.CONNECTED,
        retryCount: 0,
        lastConnectedAt: Date.now(),
      };

    case WS_EVENTS.CONNECT_FAILURE:
    case WS_EVENTS.SOCKET_ERROR:
      return {
        ...state,
        state: WS_STATES.ERROR,
        error: event.error,
      };

    case WS_EVENTS.DISCONNECT:
      return {
        ...initialWebSocketState,
        state: WS_STATES.DISCONNECTED,
      };

    case WS_EVENTS.RETRY:
      return {
        ...state,
        state: WS_STATES.RETRYING,
        retryCount: state.retryCount + 1,
      };

    default:
      return state;
  }
}
