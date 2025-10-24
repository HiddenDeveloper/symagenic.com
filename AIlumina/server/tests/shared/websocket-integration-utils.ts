/**
 * WebSocket Integration Testing Utilities
 *
 * Shared utilities for testing WebSocket message flows between server and UI.
 * These utilities can be used in both server and UI test suites.
 */

import { EventEmitter } from 'events';

// ===== MOCK WEBSOCKET CLIENT =====

/**
 * Mock WebSocket client that can connect to real server instances
 * and validate message flows
 */
export class IntegrationWebSocketClient extends EventEmitter {
  private messages: { timestamp: number; data: any; raw: string }[] = [];
  private isConnected = false;
  private websocket: any = null;

  constructor(private serverUrl: string) {
    super();
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use dynamic import to handle WebSocket in different environments
        import('ws')
          .then(({ default: WebSocket }) => {
            this.websocket = new WebSocket(this.serverUrl);

            this.websocket.on('open', () => {
              this.isConnected = true;
              this.emit('connected');
              resolve();
            });

            this.websocket.on('message', (data: Buffer) => {
              const rawMessage = data.toString();
              try {
                const parsed = JSON.parse(rawMessage);
                const message = {
                  timestamp: Date.now(),
                  data: parsed,
                  raw: rawMessage,
                };

                this.messages.push(message);
                this.emit('message', message);
              } catch (error) {
                this.emit('error', new Error(`Failed to parse message: ${rawMessage}`));
              }
            });

            this.websocket.on('error', (error: Error) => {
              this.emit('error', error);
              reject(error);
            });

            this.websocket.on('close', () => {
              this.isConnected = false;
              this.emit('disconnected');
            });
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a message to the server
   */
  send(data: any): void {
    if (!this.isConnected || !this.websocket) {
      throw new Error('WebSocket not connected');
    }

    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.websocket.send(message);
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.websocket) {
      this.websocket.close();
      this.isConnected = false;
    }
  }

  /**
   * Get all captured messages
   */
  getMessages(): { timestamp: number; data: any; raw: string }[] {
    return [...this.messages];
  }

  /**
   * Clear captured messages
   */
  clearMessages(): void {
    this.messages = [];
  }

  /**
   * Wait for a specific message or condition
   */
  waitForMessage(predicate: (message: any) => boolean, timeoutMs = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for message after ${timeoutMs}ms`));
      }, timeoutMs);

      const checkMessage = (message: { data: any }) => {
        if (predicate(message.data)) {
          clearTimeout(timeout);
          this.removeListener('message', checkMessage);
          resolve(message.data);
        }
      };

      this.on('message', checkMessage);

      // Check existing messages
      for (const message of this.messages) {
        if (predicate(message.data)) {
          clearTimeout(timeout);
          this.removeListener('message', checkMessage);
          resolve(message.data);
          return;
        }
      }
    });
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// ===== SERVER INSTANCE MANAGER =====

/**
 * Manages server instances for integration testing
 */
export class ServerInstanceManager {
  private serverProcess: any = null;
  private serverUrl: string;
  private serverPort: number;

  constructor(port = 8000) {
    this.serverPort = port;
    this.serverUrl = `ws://localhost:${port}`;
  }

  /**
   * Start a server instance for testing
   */
  async startServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // Use dynamic import to handle child_process in different environments
        import('child_process')
          .then(({ spawn }) => {
            // Start the server in development mode
            this.serverProcess = spawn('npm', ['run', 'dev'], {
              cwd: process.cwd(),
              stdio: ['pipe', 'pipe', 'pipe'],
              env: {
                ...process.env,
                PORT: this.serverPort.toString(),
                NODE_ENV: 'test',
              },
            });

            let started = false;

            this.serverProcess.stdout.on('data', (data: Buffer) => {
              const output = data.toString();
              console.log(`[Server] ${output}`);

              // Look for server startup confirmation
              if (output.includes('server') && output.includes('running') && !started) {
                started = true;
                // Give server a moment to fully start
                setTimeout(() => resolve(this.serverUrl), 1000);
              }
            });

            this.serverProcess.stderr.on('data', (data: Buffer) => {
              const error = data.toString();
              console.error(`[Server Error] ${error}`);
            });

            this.serverProcess.on('error', (error: Error) => {
              reject(error);
            });

            this.serverProcess.on('exit', (code: number) => {
              if (code !== 0 && !started) {
                reject(new Error(`Server exited with code ${code}`));
              }
            });

            // Timeout if server doesn't start
            setTimeout(() => {
              if (!started) {
                this.stopServer();
                reject(new Error('Server startup timeout'));
              }
            }, 10000);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server instance
   */
  stopServer(): void {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
    }
  }

  /**
   * Get server URL
   */
  getServerUrl(): string {
    return this.serverUrl;
  }
}

// ===== INTEGRATION TEST RUNNER =====

/**
 * High-level test runner for WebSocket integration scenarios
 */
export class WebSocketIntegrationTestRunner {
  private serverManager: ServerInstanceManager;
  private client: IntegrationWebSocketClient | null = null;

  constructor(port?: number) {
    this.serverManager = new ServerInstanceManager(port);
  }

  /**
   * Setup test environment
   */
  async setup(): Promise<void> {
    const serverUrl = await this.serverManager.startServer();
    this.client = new IntegrationWebSocketClient(serverUrl);
    await this.client.connect();
  }

  /**
   * Cleanup test environment
   */
  async teardown(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.serverManager.stopServer();
  }

  /**
   * Run a complete WebSocket flow test
   */
  async runFlowTest(scenario: {
    name: string;
    description: string;
    actions: {
      type: 'send' | 'wait' | 'validate';
      data?: any;
      condition?: (message: any) => boolean;
      validator?: (messages: any[]) => boolean;
      timeoutMs?: number;
    }[];
  }): Promise<{ success: boolean; error?: string; messages: any[] }> {
    if (!this.client) {
      throw new Error('Test environment not setup');
    }

    try {
      console.log(`Running WebSocket flow test: ${scenario.name}`);
      console.log(`Description: ${scenario.description}`);

      this.client.clearMessages();

      for (const action of scenario.actions) {
        switch (action.type) {
          case 'send':
            if (action.data) {
              this.client.send(action.data);
              console.log(`Sent: ${JSON.stringify(action.data)}`);
            }
            break;

          case 'wait':
            if (action.condition) {
              const message = await this.client.waitForMessage(
                action.condition,
                action.timeoutMs || 5000
              );
              console.log(`Received expected message: ${JSON.stringify(message)}`);
            }
            break;

          case 'validate':
            if (action.validator) {
              const messages = this.client.getMessages().map((m) => m.data);
              const isValid = action.validator(messages);
              if (!isValid) {
                return {
                  success: false,
                  error: 'Validation failed',
                  messages,
                };
              }
              console.log('Validation passed');
            }
            break;
        }
      }

      const allMessages = this.client.getMessages().map((m) => m.data);
      return {
        success: true,
        messages: allMessages,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        messages: this.client.getMessages().map((m) => m.data),
      };
    }
  }

  /**
   * Get the connected client for custom testing
   */
  getClient(): IntegrationWebSocketClient | null {
    return this.client;
  }
}

// ===== MESSAGE FLOW VALIDATORS =====

/**
 * Validators for common WebSocket message flow patterns
 */
export const MESSAGE_FLOW_VALIDATORS = {
  /**
   * Validates a complete tool call flow
   */
  validateToolCallFlow: (messages: any[]) => {
    // Expected sequence:
    // 1. tool_status (executing)
    // 2. assistant message with tool calls (this was the bug)
    // 3. tool_status (completed)
    // 4. tool result message
    // 5. done signal

    const hasToolExecuting = messages.some(
      (m) => m.tool_status === 'executing' || m.tool_call === true
    );

    const hasAssistantWithToolCalls = messages.some(
      (m) =>
        (m.role === 'assistant' && m.tool_calls) ||
        (m.role === 'assistant' && m.content && Array.isArray(m.content)) ||
        (m.role === 'model' && m.parts)
    );

    const hasToolCompleted = messages.some((m) => m.tool_status === 'completed');

    const hasDone = messages.some((m) => m.done === true);

    return hasToolExecuting && hasAssistantWithToolCalls && hasToolCompleted && hasDone;
  },

  /**
   * Validates Gemini parts array format specifically
   */
  validateGeminiPartsArray: (messages: any[]) => {
    const geminiMessages = messages.filter((m) => m.role === 'model');

    return geminiMessages.every((message) => {
      // Text-only messages should have content property
      if (typeof message.content === 'string') {
        return true;
      }

      // Tool call messages should have parts array
      if (message.parts) {
        return Array.isArray(message.parts) && message.parts.length > 0;
      }

      return false;
    });
  },

  /**
   * Validates cross-provider compatibility
   */
  validateCrossProviderCompatibility: (messages: any[]) => {
    const providerMessages = {
      openai: messages.filter((m) => m.role === 'assistant' && !Array.isArray(m.content)),
      anthropic: messages.filter((m) => m.role === 'assistant' && Array.isArray(m.content)),
      gemini: messages.filter((m) => m.role === 'model'),
    };

    // Each provider should have valid message structure
    const validOpenAI =
      providerMessages.openai.length === 0 ||
      providerMessages.openai.every(
        (m) => typeof m.content === 'string' || Array.isArray(m.tool_calls)
      );

    const validAnthropic =
      providerMessages.anthropic.length === 0 ||
      providerMessages.anthropic.every(
        (m) => Array.isArray(m.content) && m.content.every((block: any) => block.type)
      );

    const validGemini =
      providerMessages.gemini.length === 0 ||
      providerMessages.gemini.every((m) => typeof m.content === 'string' || Array.isArray(m.parts));

    return validOpenAI && validAnthropic && validGemini;
  },
};
