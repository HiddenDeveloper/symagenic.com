// Gemini-specific part types
export type Part = TextPart | FunctionCallPart | FunctionResponsePart;

export interface TextPart {
  text: string;
}

export interface FunctionCallPart {
  functionCall: {
    name: string;
    args: Record<string, unknown>; // Gemini uses parsed object for args
  };
}

export interface FunctionResponsePart {
  functionResponse: {
    name: string;
    response: string; // Tool responses are always strings across all providers
  };
}

// Provider-specific message format types
export interface OpenAIMessageFormat {
  role: Role;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string; // OpenAI uses JSON string format for arguments
    };
  }>;
  tool_call_id?: string;
  id?: string | number;
  timestamp?: string;
  [key: string]: unknown; // Allow custom fields for flexibility
}

export interface AnthropicMessageFormat {
  role: Role;
  content: ContentBlock[];
  id?: string | number;
  timestamp?: string;
  [key: string]: unknown; // Allow custom fields for flexibility
}

export interface GeminiMessageFormat {
  role: Role;
  parts: Part[];
  id?: string | number;
  timestamp?: string;
  [key: string]: unknown; // Allow custom fields for flexibility
}

// Info message formats
export interface ToolStatusFormat {
  tool_status: "started" | "completed" | "error" | "executing";
  tool_name: string;
  run_type?: string;
  execution_time?: number;
  details?: string;
  id?: string | number;
  timestamp?: string;
}

export interface VisualizationFormat {
  messageType: "visualization";
  visualizationType: string;
  data: unknown; // Visualization data can vary
  id?: string | number;
  timestamp?: string;
}

export interface SentenceFormat {
  sentence: string;
  final_sentence?: boolean;
  id?: string | number;
  timestamp?: string;
}

export interface InteractionCompleteFormat {
  done: true;
  id?: string | number;
  timestamp?: string;
}

export interface StatusFormat {
  messageType: "status";
  connection: string;
  status: string;
  error?: Error;
  id?: string | number;
  timestamp?: string;
}

// Discriminated union of all possible message formats
export type ServerMessageFormat =
  | OpenAIMessageFormat
  | AnthropicMessageFormat
  | GeminiMessageFormat
  | ToolStatusFormat
  | VisualizationFormat
  | SentenceFormat
  | InteractionCompleteFormat
  | StatusFormat;

// Import shared constants to eliminate duplication
import {
  CONNECTION_STATES,
  CONNECTION_TYPES,
  MESSAGE_ROLES,
  MESSAGE_TYPES,
  TOOL_STATUSES,
} from "@ailumina/shared/constants";

// Re-export shared constants for backward compatibility
export const MessageType = MESSAGE_TYPES;
export const ConnectionState = CONNECTION_STATES;
export const ConnectionType = CONNECTION_TYPES;
export const Role = MESSAGE_ROLES;
export const ToolStatus = TOOL_STATUSES;

// Export types for the const objects
export type MessageType = (typeof MessageType)[keyof typeof MessageType];
export type ConnectionState =
  (typeof ConnectionState)[keyof typeof ConnectionState];
export type ConnectionType =
  (typeof ConnectionType)[keyof typeof ConnectionType];
export type Role = (typeof Role)[keyof typeof Role];
export type ToolStatus = (typeof ToolStatus)[keyof typeof ToolStatus];

// Base interfaces
export interface IServerMessage {
  id?: string | number;
  timestamp?: string;
  getMessageType(): string;
  toApiFormat(): ServerMessageFormat;
}

export interface IAIChatMessage extends IServerMessage {
  role?: "user" | "assistant" | "system" | "tool" | "function" | "model";
  getText(): string | null;
  hasText(): boolean;
  isVisibleInUI(): boolean;
}

export interface IInfoMessage extends IServerMessage {
  messageType: string;
  isInfo(): boolean;
}

// Specific content block types for better type safety
export type ContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | ToolCallContentBlock;

export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ToolUseContentBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>; // Anthropic uses parsed object for input
}

export interface ToolResultContentBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string; // Tool responses are always strings across all providers
  is_error?: boolean;
}

export interface ToolCallContentBlock {
  type: "tool_call";
  tool_call: {
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string; // OpenAI uses JSON string for arguments
    };
  };
}

// Specific chat message interfaces
export interface IContentStringMessage extends IAIChatMessage {
  content: string;
}

export interface IContentArrayMessage extends IAIChatMessage {
  content: ContentBlock[];
}

export interface IPartsArrayMessage extends IAIChatMessage {
  parts: ContentBlock[];
}

// Specific info message interfaces
export interface IToolStatusMessage extends IInfoMessage {
  tool_status: "started" | "completed" | "error" | "executing";
  tool_name: string;
  run_type?: string;
  execution_time?: number;
  details?: string;
  isCompleted(): boolean;
}

export interface ToolResult {
  status: "completed" | "error"; // Changed from 'success' to 'completed' to match the actual values used
  data?: unknown;
  error?: string;
  executionTime?: number; // Added this property
}

export interface IVisualizationMessage extends IInfoMessage {
  visualizationType: string;
  data: unknown;
}

// Wrapper interface
export interface IServerMessageWrapper {
  id: string | number | undefined;
  timestamp: string | undefined;
  getType(): string;
  isChat(): boolean;
  isInfo(): boolean;
  isToolStatus(): boolean;
  getChatMessage(): IAIChatMessage | null;
  getInfoMessage(): IInfoMessage | null;
  getText(): string | null;
  hasText(): boolean;
  isVisibleInUI(): boolean;
  getImplementation(): IServerMessage;
}

// Base message class for all server messages
export abstract class ServerMessage implements IServerMessage {
  id?: string | number;
  timestamp?: string;
  protected originalData: ServerMessageFormat;

  constructor(data: ServerMessageFormat) {
    this.id = data.id || Date.now().toString();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.originalData = { ...data }; // Store original data for format preservation
  }

  // Common methods for all message types
  getMessageType(): string {
    return this.constructor.name;
  }

  // For API communication, create a server-compatible representation
  toApiFormat(): ServerMessageFormat {
    return this.originalData;
  }
}

// Add to your interfaces section
export interface ISentenceMessage extends IInfoMessage {
  sentence: string;
  final_sentence?: boolean;
}

// Add to your interfaces section
export interface IInteractionCompleteMessage extends IInfoMessage {
  done: boolean;
}

// Base class for AI chat messages
export abstract class AIChatMessage
  extends ServerMessage
  implements IAIChatMessage
{
  role?: "user" | "assistant" | "system" | "tool" | "function" | "model";

  constructor(data: ServerMessageFormat) {
    super(data);
    if ("role" in data) {
      this.role = data.role;
    }
  }

  abstract getText(): string | null;
  abstract hasText(): boolean;

  isVisibleInUI(): boolean {
    const validRole =
      this.role === "user" ||
      this.role === "assistant" ||
      this.role === "system" ||
      this.role === "model";
    return validRole && this.hasText();
  }
}

// Base class for informational messages
export abstract class InfoMessage
  extends ServerMessage
  implements IInfoMessage
{
  messageType: string;

  constructor(data: ServerMessageFormat) {
    super(data);
    this.messageType =
      "messageType" in data && typeof data.messageType === "string"
        ? data.messageType
        : "info";
  }

  // Common methods for info messages
  isInfo(): boolean {
    return true;
  }
}

// Add to your concrete implementations section
export class InteractionCompleteMessage
  extends InfoMessage
  implements IInteractionCompleteMessage
{
  done: boolean;

  constructor(data: InteractionCompleteFormat) {
    super(data);
    this.messageType = "interaction_complete";
    this.done = data.done;
  }
}

// Add to your concrete implementations section
export class SentenceMessage extends InfoMessage implements ISentenceMessage {
  sentence: string;
  final_sentence?: boolean;

  constructor(data: SentenceFormat) {
    super(data);
    this.messageType = "sentence";
    this.sentence = data.sentence;
    this.final_sentence = data.final_sentence;
  }
}

// Concrete implementations for AIChatMessage
export class ContentStringMessage
  extends AIChatMessage
  implements IContentStringMessage
{
  content: string;

  constructor(data: OpenAIMessageFormat | GeminiMessageFormat) {
    super(data);
    this.content =
      "content" in data && typeof data.content === "string" ? data.content : "";
  }

  getText(): string | null {
    return this.content || null;
  }

  hasText(): boolean {
    return typeof this.content === "string" && this.content.trim() !== "";
  }
}

export class ContentArrayMessage
  extends AIChatMessage
  implements IContentArrayMessage
{
  content: ContentBlock[];

  constructor(data: AnthropicMessageFormat) {
    super(data);
    this.content = data.content;
  }

  getText(): string | null {
    const textBlocks = this.content
      .filter((block): block is TextContentBlock => block.type === "text")
      .map((block) => block.text);

    return textBlocks.length > 0 ? textBlocks.join(" ") : null;
  }

  hasText(): boolean {
    return this.content.some(
      (block): block is TextContentBlock =>
        block.type === "text" && block.text.trim() !== "",
    );
  }
}

export class PartsArrayMessage
  extends AIChatMessage
  implements IPartsArrayMessage
{
  parts: ContentBlock[];

  constructor(data: GeminiMessageFormat) {
    super(data);
    // Convert Part[] to ContentBlock[] for compatibility
    this.parts = data.parts.map((part) => {
      if ("text" in part) {
        return { type: "text", text: part.text } as TextContentBlock;
      } else if ("functionCall" in part) {
        return {
          type: "tool_call",
          tool_call: {
            id: "gemini_call",
            type: "function",
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            },
          },
        } as ToolCallContentBlock;
      } else if ("functionResponse" in part) {
        return {
          type: "tool_result",
          tool_use_id: "gemini_response",
          content: JSON.stringify(part.functionResponse.response),
        } as ToolResultContentBlock;
      }
      return { type: "text", text: "" } as TextContentBlock;
    });
  }

  getText(): string | null {
    const textParts = this.parts
      .filter((part): part is TextContentBlock => part.type === "text")
      .map((part) => part.text);

    return textParts.length > 0 ? textParts.join(" ") : null;
  }

  hasText(): boolean {
    return this.parts.some(
      (part): part is TextContentBlock =>
        part.type === "text" && part.text.trim() !== "",
    );
  }
}

// Concrete implementations for InfoMessage
export class ToolStatusMessage
  extends InfoMessage
  implements IToolStatusMessage
{
  tool_status: "started" | "completed" | "error" | "executing";
  tool_name: string;
  run_type?: string;
  execution_time?: number;
  details?: string;

  constructor(data: ToolStatusFormat) {
    super(data);
    this.messageType = "tool_status";
    this.tool_status = data.tool_status;
    this.tool_name = data.tool_name;
    this.run_type = data.run_type;
    this.execution_time = data.execution_time;
    this.details = data.details;
  }

  isCompleted(): boolean {
    return this.tool_status === "completed";
  }
}

export class VisualizationMessage
  extends InfoMessage
  implements IVisualizationMessage
{
  visualizationType: string;
  data: unknown;

  constructor(data: VisualizationFormat) {
    super(data);
    this.messageType = "visualization";
    this.visualizationType = data.visualizationType;
    this.data = data.data;
  }
}

export class StatusMessage extends InfoMessage {
  connection: string;
  status: string;
  error?: Error;

  constructor(data: StatusFormat) {
    super(data);
    this.messageType = "status";
    this.connection = data.connection;
    this.status = data.status;
    this.error = data.error;
  }
}

export function createServerMessage(data: ServerMessageFormat): ServerMessage {
  // Type guards for specific formats
  const isInteractionComplete = (
    d: ServerMessageFormat,
  ): d is InteractionCompleteFormat =>
    "done" in d && d.done === true && Object.keys(d).length <= 3; // id, timestamp, done

  const isSentence = (d: ServerMessageFormat): d is SentenceFormat =>
    "sentence" in d;

  const isToolStatus = (d: ServerMessageFormat): d is ToolStatusFormat =>
    "tool_status" in d && "tool_name" in d;

  const isVisualization = (d: ServerMessageFormat): d is VisualizationFormat =>
    "messageType" in d && d.messageType === "visualization";

  const isStatus = (d: ServerMessageFormat): d is StatusFormat =>
    "messageType" in d && d.messageType === "status";

  const isOpenAI = (d: ServerMessageFormat): d is OpenAIMessageFormat =>
    "role" in d &&
    (("content" in d &&
      (typeof (d as OpenAIMessageFormat).content === "string" ||
        (d as OpenAIMessageFormat).content === null)) ||
      "tool_calls" in d);

  const isAnthropic = (d: ServerMessageFormat): d is AnthropicMessageFormat =>
    "role" in d && "content" in d && Array.isArray(d.content);

  const isGemini = (d: ServerMessageFormat): d is GeminiMessageFormat =>
    "role" in d && "parts" in d && Array.isArray(d.parts);

  // Interaction complete messages
  if (isInteractionComplete(data)) {
    return new InteractionCompleteMessage(data);
  }

  // Sentence messages
  if (isSentence(data)) {
    return new SentenceMessage(data);
  }

  // Tool status messages
  if (isToolStatus(data)) {
    return new ToolStatusMessage(data);
  }

  // Visualization messages
  if (isVisualization(data)) {
    return new VisualizationMessage(data);
  }

  // Status messages
  if (isStatus(data)) {
    return new StatusMessage(data);
  }

  // Chat messages
  if ("role" in data) {
    // Handle OpenAI assistant messages with tool_calls
    if (isOpenAI(data) && data.tool_calls && Array.isArray(data.tool_calls)) {
      // Create a content array format that our existing classes can handle
      const toolCallsAsContent = data.tool_calls.map((call) => ({
        type: "tool_call" as const,
        tool_call: call,
      }));

      // Convert to Anthropic-like format for ContentArrayMessage
      const modifiedData: AnthropicMessageFormat = {
        ...data,
        content: toolCallsAsContent as ContentBlock[],
      };

      return new ContentArrayMessage(modifiedData);
    }

    // Regular content formats
    if (isOpenAI(data) && typeof data.content === "string") {
      return new ContentStringMessage(data);
    } else if (isAnthropic(data)) {
      return new ContentArrayMessage(data);
    } else if (isGemini(data)) {
      return new PartsArrayMessage(data);
    }
  }

  throw new Error("Unknown message format");
}

export class ServerMessageHistory {
  private messages: ServerMessage[] = [];

  /**
   * Add a message to the history
   * @param message The server message to add
   * @returns The index of the added message
   */
  add(message: ServerMessage): number {
    this.messages.push(message);
    return this.messages.length - 1;
  }

  /**
   * Add a raw message object by converting it to the appropriate message type
   * @param data Raw message data from the server
   * @returns The index of the added message
   */
  addRaw(data: ServerMessageFormat): number {
    const message = createServerMessage(data);
    return this.add(message);
  }

  /**
   * Get all messages in the history
   */
  getAll(): ServerMessage[] {
    return [...this.messages];
  }

  /**
   * Get chat messages only
   */
  getChatMessages(): IAIChatMessage[] {
    return this.messages.filter(
      (message) => message instanceof AIChatMessage,
    ) as IAIChatMessage[];
  }

  /**
   * Get messages visible in the UI
   */
  getVisibleMessages(): IAIChatMessage[] {
    const filtered = this.messages.filter(
      (message) => message instanceof AIChatMessage && message.isVisibleInUI(),
    );
    return filtered.map((msg) => msg as unknown as IAIChatMessage);
  }

  /**
   * Get info messages only
   */
  getInfoMessages(): IInfoMessage[] {
    return this.messages.filter(
      (message) => message instanceof InfoMessage,
    ) as IInfoMessage[];
  }

  /**
   * Get tool status messages
   */
  getToolStatusMessages(): IToolStatusMessage[] {
    return this.messages.filter(
      (message) => message instanceof ToolStatusMessage,
    ) as IToolStatusMessage[];
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get the number of messages in the history
   */
  get length(): number {
    return this.messages.length;
  }
}

// Add Message and CurrentToolState interfaces
export interface Message {
  role: MessageRole;
  content?: string | ContentBlock[];
  id?: string | number;
  timestamp?: string;
  toolRuns?: ToolRun[];
  interactionTime?: number;
  parts?: Part[];
  isPartial?: boolean;
  isError?: boolean;
}

export interface CurrentToolState {
  name: string;
  startTime: number;
  isRunning: boolean;
  hasError: boolean;
  errorMessage?: string;
}

// Additional shared types for UI components
export type MessageRole =
  | "user"
  | "assistant"
  | "system"
  | "tool"
  | "function"
  | "model";

// Part interface is already defined at the top of the file as a union type
// This duplicate is removed to avoid confusion

export interface ToolRun {
  name: string;
  input: string | object;
  output?: string | object;
  status: "running" | "completed" | "error"; // Matches ToolStatus enum values
  error?: string;
}

/**
 * Normalize message content across different LLM formats
 * Handles different formats like Anthropic's content and Gemini's parts
 */
export function normalizeMessageContent(message: Message): string {
  // First check if the message has getText() method (from our wrapper classes)
  if (typeof (message as IAIChatMessage).getText === "function") {
    const text = (message as IAIChatMessage).getText();
    if (text) return text;
  }

  // Handle string content
  if (typeof message.content === "string") {
    return message.content;
  }

  // Handle array content (both Anthropic and Gemini formats use similar structures)
  if (message.content && Array.isArray(message.content)) {
    return message.content
      .filter((block): block is TextContentBlock => block.type === "text")
      .map((block) => block.text)
      .join(" ");
  }

  // Handle parts array (Gemini format)
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter((part): part is TextPart => "text" in part)
      .map((part) => part.text)
      .join(" ");
  }

  // No content found
  return "";
}

/**
 * Check if a message has text content (either in content or parts)
 */
export function messageHasText(message: Message): boolean {
  // First check if the message has hasText() method
  if (typeof (message as IAIChatMessage).hasText === "function") {
    return (message as IAIChatMessage).hasText();
  }

  // Check for string content
  if (typeof message.content === "string") {
    return message.content.trim() !== "";
  }

  // Check for array content (both Anthropic and Gemini formats)
  const hasArrayContent = message.content && Array.isArray(message.content);
  const hasArrayParts = message.parts && Array.isArray(message.parts);

  if (hasArrayContent) {
    return (message.content as ContentBlock[]).some(
      (block): block is TextContentBlock =>
        block.type === "text" && block.text.trim() !== "",
    );
  }

  if (hasArrayParts && message.parts) {
    return message.parts.some(
      (part): part is TextPart => "text" in part && part.text.trim() !== "",
    );
  }

  return false;
}

/**
 * Utility function to detect which AI provider a message is from based on its structure
 */
export function detectAIProvider(
  message: Message,
): "openai" | "anthropic" | "gemini" | "unknown" {
  // Check for Gemini-specific structure (parts array)
  if (message.parts && Array.isArray(message.parts)) {
    return "gemini";
  }

  // Check for Anthropic-specific structure (content array with text blocks)
  if (
    message.content &&
    Array.isArray(message.content) &&
    message.content.some((block) => block.type === "text")
  ) {
    return "anthropic";
  }

  // Check for OpenAI-specific structure (simple string content)
  if (typeof message.content === "string") {
    return "openai";
  }

  // Fallback: if content exists but no parts, assume OpenAI
  if (message.content && !message.parts) {
    return "openai";
  }

  // Couldn't determine provider
  return "unknown";
}

/**
 * Utility function to determine if a message should be displayed
 * based on its role and the AI provider
 */
export function shouldDisplayMessage(message: Message): boolean {
  const provider = detectAIProvider(message);

  // For OpenAI, hide system and tool messages
  if (
    provider === "openai" &&
    (message.role === "system" || message.role === "tool")
  ) {
    return false;
  }

  // Display all messages for other providers
  return true;
}

/**
 * Helper function to parse tool parameters based on provider format
 * OpenAI: arguments as JSON string -> needs JSON.parse()
 * Gemini/Anthropic: args/input as parsed object -> use directly
 */
export function parseToolParameters(
  provider: "openai" | "anthropic" | "gemini",
  parameters: string | Record<string, unknown>,
): Record<string, unknown> {
  if (provider === "openai" && typeof parameters === "string") {
    try {
      return JSON.parse(parameters);
    } catch (error) {
      console.error("Failed to parse OpenAI tool parameters:", error);
      return {};
    }
  }

  if (typeof parameters === "object" && parameters !== null) {
    return parameters;
  }

  return {};
}

/**
 * Helper function to format tool parameters for API calls based on provider
 * OpenAI: JSON.stringify() -> string format
 * Gemini/Anthropic: use object directly
 */
export function formatToolParameters(
  provider: "openai" | "anthropic" | "gemini",
  parameters: Record<string, unknown>,
): string | Record<string, unknown> {
  if (provider === "openai") {
    return JSON.stringify(parameters);
  }

  return parameters;
}

/**
 * Helper function to ensure tool responses are always strings
 * All providers expect tool responses as strings
 */
export function formatToolResponse(response: unknown): string {
  if (typeof response === "string") {
    return response;
  }

  if (response === null || response === undefined) {
    return "";
  }

  try {
    return JSON.stringify(response);
  } catch (error: unknown) {
    let errMsg = "Failed to format tool response";
    if (error instanceof Error) {
      errMsg = error.message;
    }
    console.error(errMsg);
    return String(errMsg);
  }
}
