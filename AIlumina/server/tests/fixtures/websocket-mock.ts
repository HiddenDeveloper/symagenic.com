/**
 * WebSocket Mock for Testing
 * Captures all WebSocket messages sent during provider execution
 */

export interface WebSocketMessage {
  timestamp: number;
  data: any;
  type:
    | 'tool_status'
    | 'assistant_message'
    | 'tool_message'
    | 'sentence'
    | 'done'
    | 'error'
    | 'other';
}

export class MockWebSocket {
  private messages: WebSocketMessage[] = [];
  private isConnected = true;

  constructor() {
    this.messages = [];
  }

  /**
   * Mock WebSocket send method - captures messages
   */
  send(data: string): void {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    try {
      const parsed = JSON.parse(data);
      const message: WebSocketMessage = {
        timestamp: Date.now(),
        data: parsed,
        type: this.classifyMessage(parsed),
      };

      this.messages.push(message);
      console.log(`[MockWebSocket] Captured: ${data}`);
    } catch (error) {
      console.error('[MockWebSocket] Failed to parse message:', error);
    }
  }

  /**
   * Classify message type based on content
   */
  private classifyMessage(data: any): WebSocketMessage['type'] {
    if (data.tool_status || data.tool_call) {
      return 'tool_status';
    }
    if (data.role === 'assistant' && (data.tool_calls || data.content)) {
      return 'assistant_message';
    }
    if (data.role === 'tool') {
      return 'tool_message';
    }
    if (data.sentence !== undefined) {
      return 'sentence';
    }
    if (data.done === true) {
      return 'done';
    }
    if (data.error) {
      return 'error';
    }
    return 'other';
  }

  /**
   * Get all captured messages
   */
  getMessages(): WebSocketMessage[] {
    return [...this.messages];
  }

  /**
   * Get messages by type
   */
  getMessagesByType(type: WebSocketMessage['type']): WebSocketMessage[] {
    return this.messages.filter((msg) => msg.type === type);
  }

  /**
   * Get messages in chronological order
   */
  getMessagesChronological(): WebSocketMessage[] {
    return this.messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear all captured messages
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    this.isConnected = false;
  }

  /**
   * Check if WebSocket is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Validate expected message flow
   */
  validateToolCallFlow(): {
    valid: boolean;
    missing: string[];
    unexpected: string[];
    messages: WebSocketMessage[];
  } {
    const messages = this.getMessagesChronological();
    const missing: string[] = [];
    const unexpected: string[] = [];

    // Check for required message types in tool call flow
    const requiredTypes = ['tool_status', 'tool_message', 'sentence', 'done'];
    const foundTypes = new Set(messages.map((msg) => msg.type));

    requiredTypes.forEach((type) => {
      if (!foundTypes.has(type as WebSocketMessage['type'])) {
        missing.push(type);
      }
    });

    // Check for assistant message with tool_calls (this is currently missing)
    const assistantMessages = this.getMessagesByType('assistant_message');
    const assistantWithToolCalls = assistantMessages.find(
      (msg) =>
        msg.data.tool_calls && Array.isArray(msg.data.tool_calls) && msg.data.tool_calls.length > 0
    );

    if (!assistantWithToolCalls) {
      missing.push('assistant_message_with_tool_calls');
    }

    return {
      valid: missing.length === 0,
      missing,
      unexpected,
      messages,
    };
  }

  /**
   * Get a summary of the message flow
   */
  getFlowSummary(): string {
    const messages = this.getMessagesChronological();
    return messages
      .map((msg, index) => {
        const data = JSON.stringify(msg.data, null, 2);
        return `${index + 1}. [${msg.type}] ${data}`;
      })
      .join('\n');
  }

  /**
   * Validate basic message flow
   */
  validateMessageFlow(): { valid: boolean; errors: string[] } {
    return WebSocketFlowValidator.validateToolCallSequence(this.getMessagesChronological());
  }
}

/**
 * WebSocket message flow validation utilities
 */
class WebSocketFlowValidator {
  /**
   * Validate that messages follow the expected tool call sequence
   */
  static validateToolCallSequence(messages: WebSocketMessage[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Expected sequence for tool calls:
    // 1. tool_status (started/executing)
    // 2. assistant_message with tool_calls (currently missing)
    // 3. tool_status (completed)
    // 4. tool_message
    // 5. sentence responses
    // 6. final assistant_message
    // 7. done

    let currentIndex = 0;

    // Check for tool status started
    if (currentIndex < messages.length && messages[currentIndex].type === 'tool_status') {
      const statusData = messages[currentIndex].data;
      if (statusData.tool_status === 'started' || statusData.tool_status === 'executing') {
        currentIndex++;
      } else {
        warnings.push('First tool status should be "started" or "executing"');
      }
    } else {
      errors.push('Missing initial tool status message');
    }

    // Check for assistant message with tool calls (this is the bug we're testing for)
    if (currentIndex < messages.length && messages[currentIndex].type === 'assistant_message') {
      const assistantData = messages[currentIndex].data;
      if (assistantData.tool_calls && Array.isArray(assistantData.tool_calls)) {
        currentIndex++;
      } else {
        warnings.push('Assistant message found but without tool_calls');
      }
    } else {
      errors.push('Missing assistant message with tool_calls - this indicates the bug we found');
    }

    // Check for tool completion status
    const completionIndex = messages.findIndex(
      (msg) =>
        msg.type === 'tool_status' &&
        (msg.data.tool_status === 'completed' || msg.data.tool_status === 'error')
    );

    if (completionIndex === -1) {
      errors.push('Missing tool completion status');
    }

    // Check for tool result message
    const toolMessageIndex = messages.findIndex((msg) => msg.type === 'tool_message');
    if (toolMessageIndex === -1) {
      errors.push('Missing tool result message');
    }

    // Check for final done message
    const doneIndex = messages.findIndex((msg) => msg.type === 'done');
    if (doneIndex === -1) {
      errors.push('Missing done message');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Compare actual flow with expected flow
   */
  static compareWithExpectedFlow(
    messages: WebSocketMessage[],
    expectedTypes: WebSocketMessage['type'][]
  ): {
    matches: boolean;
    actualTypes: WebSocketMessage['type'][];
    missing: WebSocketMessage['type'][];
    extra: WebSocketMessage['type'][];
  } {
    const actualTypes = messages.map((msg) => msg.type);
    const missing = expectedTypes.filter((type) => !actualTypes.includes(type));
    const extra = actualTypes.filter((type) => !expectedTypes.includes(type));

    return {
      matches: missing.length === 0 && extra.length === 0,
      actualTypes,
      missing,
      extra,
    };
  }
}
