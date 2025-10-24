import type { Message } from "@ailumina/shared/types";

import type { ServerMessageFormat } from "./AIServiceTypes";
import {
  initialWebSocketState,
  WebSocketEvent,
  webSocketReducer,
  WebSocketState,
  WS_EVENTS,
  WS_STATES,
} from "./WebSocketStateMachine";

// Outbound message payload to AI service
export interface AIServicePayload {
  user_input: string;
  chat_messages: Message[];
  fileId?: string;
}

// Inbound messages from AI service
type AIServiceMessage = ServerMessageFormat;

type RawMessageListener = (data: AIServiceMessage) => void;

class WebSocketService {
  private aiSocket: WebSocket | null = null;
  private wsState = initialWebSocketState;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private rawMessageListeners: RawMessageListener[] = [];

  private dispatchWSEvent(event: WebSocketEvent) {
    this.wsState = webSocketReducer(this.wsState, event);
  }

  public getConnectionState(): WebSocketState {
    return this.wsState.state;
  }

  public async connect(agentType: string = "AIlumina"): Promise<boolean> {
    // Idempotent: if a socket is already open or connecting, do nothing.
    if (
      this.wsState.state === WS_STATES.CONNECTING ||
      this.wsState.state === WS_STATES.CONNECTED ||
      (this.aiSocket &&
        (this.aiSocket.readyState === WebSocket.OPEN ||
          this.aiSocket.readyState === WebSocket.CONNECTING))
    ) {
      return false;
    }

    this.dispatchWSEvent({ type: WS_EVENTS.CONNECT });

    try {
      // Prefer explicit env override, else same-origin (dev uses Vite proxy)
      const override = (import.meta as { env?: Record<string, string> }).env
        ?.VITE_WS_URL;
      const base =
        override && override.length > 0
          ? override.replace(/\/$/, "")
          : window.location.origin.replace(/^http/, "ws");
      const url = `${base}/ws/${agentType}`;
      this.aiSocket = new WebSocket(url);

      this.aiSocket.onopen = () => {
        console.log("[WebSocketService] Connected");
        this.dispatchWSEvent({ type: WS_EVENTS.CONNECT_SUCCESS });
      };

      this.aiSocket.onerror = (err) => {
        console.error("[WebSocketService] Socket error:", err);
        this.dispatchWSEvent({
          type: WS_EVENTS.SOCKET_ERROR,
          error: err instanceof Error ? err : new Error("Socket error"),
        });
      };

      this.aiSocket.onclose = () => {
        console.log("[WebSocketService] Connection closed");
        this.dispatchWSEvent({
          type: WS_EVENTS.CONNECT_FAILURE,
          error: new Error("Socket closed"),
        });
        this.scheduleReconnect();
      };

      this.aiSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.rawMessageListeners.forEach((fn) => fn(data));
        } catch (e) {
          console.error("[WebSocketService] Failed to parse message:", e);
        }
      };

      return true;
    } catch (error) {
      this.dispatchWSEvent({
        type: WS_EVENTS.CONNECT_FAILURE,
        error: error instanceof Error ? error : new Error("Connection failed"),
      });
      this.scheduleReconnect();
      return false;
    }
  }

  public disconnect(): void {
    if (this.aiSocket) {
      this.aiSocket.close();
      this.aiSocket = null;
    }

    this.dispatchWSEvent({ type: WS_EVENTS.DISCONNECT });
  }

  public onRawMessage(listener: RawMessageListener): () => void {
    this.rawMessageListeners.push(listener);
    return () => {
      this.rawMessageListeners = this.rawMessageListeners.filter(
        (l) => l !== listener,
      );
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    this.dispatchWSEvent({ type: WS_EVENTS.RETRY });

    this.reconnectTimeout = setTimeout(() => {
      console.log("[WebSocketService] Reconnecting...");
      this.connect().catch((err) =>
        console.error("[WebSocketService] Reconnect failed:", err),
      );
    }, 5000);
  }

  public send(data: AIServicePayload): void {
    if (!this.aiSocket || this.aiSocket.readyState !== WebSocket.OPEN) {
      console.error("[WebSocketService] Cannot send — socket not open");
      return;
    }

    try {
      this.aiSocket.send(JSON.stringify(data));
    } catch (err) {
      console.error("[WebSocketService] Failed to send message:", err);
    }
  }
}

const webSocketService = new WebSocketService();
export default webSocketService;
