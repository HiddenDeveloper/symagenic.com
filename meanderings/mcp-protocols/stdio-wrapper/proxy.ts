/**
 * HTTP proxy client for STDIO wrapper
 */

import { StdioWrapperConfig } from "../shared/types.js";

export class HttpProxy {
  constructor(private config: StdioWrapperConfig) {}

  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.remoteUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to connect to remote server at ${url}:`, error);
      throw new Error(`Remote server unavailable. Make sure it's running at ${this.config.remoteUrl}`);
    }
  }

  async listTools() {
    return this.makeRequest('/mcp/tools');
  }

  async callTool(name: string, args: any) {
    return this.makeRequest(`/mcp/tools/${name}`, {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  async listResources() {
    return this.makeRequest('/mcp/resources');
  }

  async readResource(uri: string) {
    const encodedUri = encodeURIComponent(uri);
    return this.makeRequest(`/mcp/resources/${encodedUri}`);
  }

  async checkHealth() {
    return this.makeRequest('/health');
  }
}