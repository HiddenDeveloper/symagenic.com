/**
 * WebSocket client utilities for connecting to Ailumina server
 */

import WebSocket from 'ws';

export interface AiluminaMessage {
  user_input: string;
  chat_messages: any[];
  fileId?: string;
}

export interface AiluminaResponse {
  type?: string;
  content?: string;
  sentence?: string;
  tool_name?: string;
  tool_status?: string;
  error?: string;
  role?: string;
  done?: boolean;
  [key: string]: any;
}

export interface WebSocketClientOptions {
  serverUrl?: string;
  timeout?: number;
  retries?: number;
}

export class AiluminaWebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private isConnected = false;
  private responseContent = '';

  constructor(options: WebSocketClientOptions = {}) {
    this.options = {
      serverUrl: options.serverUrl || process.env.AILUMINA_SERVER_URL || 'ws://localhost:8000',
      timeout: options.timeout || parseInt(process.env.AILUMINA_TIMEOUT || '120000', 10),
      retries: options.retries || parseInt(process.env.AILUMINA_RETRIES || '3', 10)
    };
  }

  /**
   * Connect to Ailumina WebSocket endpoint
   */
  async connect(agentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Handle case-sensitive agent type mapping
        const agentPath = agentType === 'ailumina' ? 'AIlumina' : agentType;
        const url = `${this.options.serverUrl}/ws/${agentPath}`;
        console.error(`[AiluminaWebSocketClient] Connecting to ${url}`);
        
        // Add proper headers for WebSocket connection
        const headers = {
          'Origin': this.options.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://'),
          'User-Agent': 'Ailumina-MCP-Client/1.0.0'
        };
        
        this.ws = new WebSocket(url, { headers });
        
        const timeout = setTimeout(() => {
          reject(new Error(`Connection timeout after ${this.options.timeout}ms`));
          this.cleanup();
        }, this.options.timeout);

        this.ws.on('open', () => {
          console.error('[AiluminaWebSocketClient] Connected successfully');
          clearTimeout(timeout);
          this.isConnected = true;
          resolve();
        });

        this.ws.on('error', (error: Error) => {
          console.error('[AiluminaWebSocketClient] Connection error:', error);
          clearTimeout(timeout);
          reject(error);
        });

        this.ws.on('close', () => {
          console.error('[AiluminaWebSocketClient] Connection closed');
          this.isConnected = false;
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a chat message and process responses until completion
   */
  async sendChatMessage(message: AiluminaMessage): Promise<string> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      this.responseContent = '';
      
      const timeout = setTimeout(() => {
        reject(new Error(`Response timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      // Set up message handler
      this.ws!.on('message', (data: Buffer) => {
        try {
          const response: AiluminaResponse = JSON.parse(data.toString());
          console.error('[AiluminaWebSocketClient] Received:', response);
          
          // Check for 'done' field first (Ailumina completion signal)
          if (response.done === true) {
            console.error('[AiluminaWebSocketClient] Done signal received');
            clearTimeout(timeout);
            resolve(this.responseContent.trim());
            return;
          }
          
          // Handle sentence messages (streaming response) - model-agnostic approach
          if (response.sentence) {
            this.responseContent += response.sentence;
            console.error(`[AiluminaWebSocketClient] Accumulated sentence: "${response.sentence}"`);
          }
          
          // Handle different message types for logging and control flow
          switch (response.type) {
            case 'sentence':
              // Already handled above with response.sentence check
              break;
              
            case 'tool_running':
              console.error(`[AiluminaWebSocketClient] Tool running: ${response.tool_name}`);
              break;
              
            case 'tool_complete':
              console.error(`[AiluminaWebSocketClient] Tool completed: ${response.tool_name}`);
              break;
              
            case 'complete':
              // Interaction complete - return the accumulated response
              console.error('[AiluminaWebSocketClient] Interaction complete');
              clearTimeout(timeout);
              resolve(this.responseContent.trim());
              return;
              
            case 'error':
              clearTimeout(timeout);
              reject(new Error(response.error || 'Unknown error from Ailumina'));
              return;
          }
          
          // Log other message types but don't process content (rely on sentence accumulation only)
          if (response.role) {
            console.error(`[AiluminaWebSocketClient] Received ${response.role} message (content ignored - using sentence accumulation)`);
          }
          
        } catch (error) {
          clearTimeout(timeout);
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`));
        }
      });

      // Send the message
      try {
        const payload = JSON.stringify(message);
        console.error('[AiluminaWebSocketClient] Sending:', payload);
        this.ws!.send(payload);
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if the client is connected
   */
  get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Utility function to execute a chat request to Ailumina
 */
export async function executeAiluminaChat(
  agentType: string,
  userInput: string,
  chatMessages: any[] = [],
  fileId?: string,
  options?: WebSocketClientOptions
): Promise<string> {
  const client = new AiluminaWebSocketClient(options);
  
  try {
    await client.connect(agentType);
    
    const message: AiluminaMessage = {
      user_input: userInput,
      chat_messages: chatMessages
    };
    
    if (fileId) {
      message.fileId = fileId;
    }
    
    const response = await client.sendChatMessage(message);
    return response;
    
  } finally {
    client.disconnect();
  }
}