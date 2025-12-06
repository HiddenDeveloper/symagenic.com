/**
 * HTTP Proxy for Qdrant Facts STDIO Wrapper
 *
 * Proxies tool calls to the Facts HTTP server.
 */

import { FACTS_STDIO_CONFIG } from './config/settings.js';

export class FactsHttpProxy {
  private readonly baseUrl: string;
  private readonly authToken: string;

  constructor() {
    this.baseUrl = FACTS_STDIO_CONFIG.http.url;
    this.authToken = FACTS_STDIO_CONFIG.http.authToken;
  }

  /**
   * Check if HTTP server is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Facts HTTP server health check failed:', error);
      return false;
    }
  }

  /**
   * Execute a tool via HTTP server
   */
  async executeTool(toolName: string, parameters: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ parameters })
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Facts proxy error (${toolName}):`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
