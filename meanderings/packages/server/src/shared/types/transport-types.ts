/**
 * Transport Types
 *
 * Type definitions for transport layer responses
 */

/**
 * Base transport result
 */
export interface TransportResult {
  type: 'streaming' | 'non_streaming';
  data?: unknown;
  raw?: unknown;
}

/**
 * Non-streaming transport result
 */
export interface NonStreamingTransportResult extends TransportResult {
  type: 'non_streaming';
  data: {
    content?: {
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: unknown;
    }[];
    stop_reason?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

/**
 * Streaming transport result
 */
export interface StreamingTransportResult extends TransportResult {
  type: 'streaming';
  stream: AsyncIterable<unknown>;
}

/**
 * Processed streaming result
 */
export interface ProcessedStreamingResult {
  fullText: string;
  toolUse?: {
    type: string;
    id: string;
    name: string;
    input: unknown;
  }[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  stopReason?: string;
}
