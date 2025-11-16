import type {
  ContentBlock,
  Message,
  MessagePart,
} from "@ailumina/shared/types";
import { createActor } from "xstate";

import {
  AIChatMessage,
  createServerMessage,
  InteractionCompleteMessage,
  SentenceMessage,
  ServerMessageFormat,
  ToolStatusMessage,
} from "../types/AIServiceTypes";
import { AIStateMachine } from "../statemachines/AIStateMachine";
import webSocketService, { type AIServicePayload } from "./WebSocketService";

// Type definition for state observer data - observers get the full typed message
type AIStateData = {
  sentence: SentenceMessage;
  tool_running: ToolStatusMessage;
  tool_complete: ToolStatusMessage;
  complete: InteractionCompleteMessage;
  error: { error: string | Error }; // Keep as-is for error handling
  chat_message: AIChatMessage;
  thinking: { userInput: string }; // Keep as-is for UI state
};

// Type definition for state observers - using string for state to maintain compatibility
type AIStateObserver = (
  state: string,
  data?: AIStateData[keyof AIStateData],
) => void;

export interface AIServiceConfig {
  onResponseStart?: () => void;
  onResponseChunk?: (chunk: string) => void;
  onResponseComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface AIServiceOptions {
  config?: AIServiceConfig;
}

class AIService {
  private actor = createActor(AIStateMachine).start();
  private config: AIServiceConfig;
  private _isConnected = false;
  private unsubscribeRawMessage?: () => void;

  constructor(options: AIServiceOptions = {}) {
    console.log("🧠 AIService initialized with XState actor and WebSocket");
    this.config = options.config || {};

    // Subscribe to actor state changes
    this.actor.subscribe((snapshot) => {
      const { context, value } = snapshot;

      if (value === "responding" && context.response) {
        this.config.onResponseChunk?.(context.response);
      }

      if (value === "complete") {
        this.config.onResponseComplete?.(context.response);
      }

      if (value === "error" && context.error) {
        this.config.onError?.(new Error(context.error));
      }
    });

    // Bind WebSocket message listener
    this.unsubscribeRawMessage = webSocketService.onRawMessage(
      this.handleRawMessage.bind(this),
    );
  }

  // Type definition for state observers
  // type AIStateObserver = (state: string, data?: any) => void;

  // State observer list
  private stateObservers: AIStateObserver[] = [];

  // Method to add a state observer
  public addStateObserver(observer: AIStateObserver): () => void {
    this.stateObservers.push(observer);
    console.log(
      `[AIService] Added state observer, count: ${this.stateObservers.length}`,
    );

    // Return a function to remove this observer
    return () => {
      this.stateObservers = this.stateObservers.filter(
        (obs) => obs !== observer,
      );
      console.log(
        `[AIService] Removed state observer, count: ${this.stateObservers.length}`,
      );
    };
  }

  // Method to notify observers of state changes
  private notifyStateObservers(
    state: string,
    data?: AIStateData[keyof AIStateData],
  ): void {
    this.stateObservers.forEach((observer) => {
      try {
        observer(state, data);
      } catch (error) {
        console.error("[AIService] Error in state observer:", error);
      }
    });
  }

  private handleRawMessage(message: unknown) {
    try {
      const parsed = createServerMessage(message as ServerMessageFormat);

      if (parsed instanceof SentenceMessage) {
        this.actor.send({
          type: "RECEIVE_SENTENCE",
          content: parsed.sentence,
        });
        this.notifyStateObservers("sentence", parsed);
      } else if (
        parsed instanceof ToolStatusMessage &&
        (parsed.tool_status === "started" || parsed.tool_status === "executing")
      ) {
        this.actor.send({ type: "TOOL_EXECUTION_START" });
        this.notifyStateObservers("tool_running", parsed);
      } else if (
        parsed instanceof ToolStatusMessage &&
        parsed.tool_status === "completed"
      ) {
        this.actor.send({ type: "TOOL_EXECUTION_COMPLETE" });
        this.notifyStateObservers("tool_complete", parsed);
      } else if (parsed instanceof InteractionCompleteMessage) {
        this.actor.send({ type: "RECEIVE_INTERACTION_COMPLETE" });
        this.notifyStateObservers("complete", parsed);
      } else if (message && typeof message === "object" && "error" in message) {
        const errorValue = (message as { error: string | Error }).error;
        this.actor.send({
          type: "ERROR",
          error:
            typeof errorValue === "string" ? errorValue : errorValue.message,
        });
        this.notifyStateObservers("error", { error: errorValue });
      }
      // Add handling for chat messages
      else if (parsed instanceof AIChatMessage) {
        // Determine if this is a user or assistant message
        const role = parsed.role || "unknown";
        const content = parsed.getText() || "";

        // Notify observers about the chat message
        this.notifyStateObservers(
          "chat_message",
          parsed as unknown as AIStateData[keyof AIStateData],
        );

        // If it's an assistant message, also trigger the actor event
        if (role === "assistant") {
          this.actor.send({ type: "RECEIVE_SENTENCE", content });
        }
      }
      // Special handling for assistant messages with tool_calls that might not be recognized as AIChatMessage
      // else if (message.role === 'assistant' && message.tool_calls) {
      //   console.log('[AIService] Processing assistant message with tool_calls:', message);
      //   // Notify about the assistant's intent to call a tool
      //   this.notifyStateObservers('chat_message', message);
      // }
      else {
        console.warn(
          "[AIService] Unknown message type:",
          parsed.getMessageType(),
          "message:",
          message,
        );
      }
    } catch (err) {
      console.error("[AIService] Error parsing WebSocket message:", err);
      this.actor.send({ type: "ERROR", error: "Malformed WebSocket message" });
      this.notifyStateObservers("error", {
        error: "Malformed WebSocket message",
      });
    }
  }

  public async connect(): Promise<boolean> {
    this._isConnected = await webSocketService.connect();
    return this._isConnected;
  }

  public disconnect() {
    webSocketService.disconnect();
    this._isConnected = false;
  }

  public sendRequest(input: string) {
    this.actor.send({ type: "SEND_REQUEST", input });
    this.config.onResponseStart?.();
  }

  public completeInteraction() {
    this.actor.send({ type: "RECEIVE_INTERACTION_COMPLETE" });
  }

  public clear() {
    this.actor.send({ type: "CLEAR" });
  }

  public isConnected() {
    return this._isConnected;
  }

  public getSnapshot() {
    return this.actor.getSnapshot();
  }

  public destroy() {
    this.unsubscribeRawMessage?.();
  }

  public initialize(): void {
    console.log("[AIService] Initializing...");
    this.connect().catch((err) => {
      console.error("[AIService] Failed to connect:", err);
    });
  }

  public sendUserMessage(
    userInput: string,
    chatMessages: Message[] = [],
    fileId?: string,
  ) {
    const payload: AIServicePayload = {
      user_input: userInput,
      chat_messages: chatMessages,
      ...(fileId && { fileId }),
    };

    this.notifyStateObservers("thinking", { userInput });

    console.log("[AIService] Sending payload to WebSocket:", payload);
    webSocketService.send(payload);
  }

  public isToolMessage(message: Message): boolean {
    if (!message) return false;

    // Check role-based identification
    if (message.role === "tool" || message.role === "function") {
      return true;
    }

    // Check for OpenAI tool_calls format (assistant messages with tool_calls)
    if (
      message.role === "assistant" &&
      message.tool_calls &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0
    ) {
      return true;
    }

    // Check for tool calls in content (OpenAI format)
    if (Array.isArray(message.content)) {
      if (message.content.some((c: ContentBlock) => c.type === "tool_call")) {
        return true;
      }
    }

    // Check for tool calls in parts (various formats)
    if (Array.isArray(message.parts)) {
      // Check for tool_calls in parts (Anthropic)
      if (
        message.parts.some((p: MessagePart) => {
          const partWithToolCalls = p as MessagePart & {
            tool_calls?: unknown[];
          };
          return (
            partWithToolCalls.tool_calls &&
            Array.isArray(partWithToolCalls.tool_calls) &&
            partWithToolCalls.tool_calls.length > 0
          );
        })
      ) {
        return true;
      }

      // Check for functionResponse in parts (Google/Gemini response)
      if (message.parts.some((p: MessagePart) => p.functionResponse)) {
        return true;
      }

      // Check for functionCall in parts (Google/Gemini call)
      if (message.parts.some((p: MessagePart) => p.functionCall)) {
        return true;
      }
    }

    // Check for toolRuns property (some message formats)
    const messageWithToolRuns = message as Message & { toolRuns?: unknown[] };
    if (
      messageWithToolRuns.toolRuns &&
      Array.isArray(messageWithToolRuns.toolRuns) &&
      messageWithToolRuns.toolRuns.length > 0
    ) {
      return true;
    }

    return false;
  }
}

export default new AIService();
