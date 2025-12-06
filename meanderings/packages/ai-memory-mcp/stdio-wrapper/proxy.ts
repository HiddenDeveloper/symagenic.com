/**
 * HTTP proxy for Memory STDIO wrapper
 */

import fetch from 'node-fetch';
import { MEMORY_STDIO_CONFIG } from './config/settings.js';
import { handleMemorySampling, formatSamplingResponse } from './sampling/handlers.js';
import type { MemoryToolResponse } from '../shared/types.js';

export class MemoryHttpProxy {
  private baseUrl: string;
  private authToken: string;

  constructor() {
    this.baseUrl = MEMORY_STDIO_CONFIG.httpServerUrl;
    this.authToken = MEMORY_STDIO_CONFIG.authToken;
  }

  /**
   * Execute a tool via HTTP proxy with sampling
   */
  async executeTool(toolName: string, parameters: any): Promise<MemoryToolResponse> {
    try {
      console.error(`🔧 Executing tool: ${toolName} with parameters:`, JSON.stringify(parameters, null, 2));
      
      const response = await fetch(`${this.baseUrl}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ parameters }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      console.error(`📨 HTTP Response for ${toolName}:`, JSON.stringify(data, null, 2));
      
      // Convert HTTP response to MCP format
      const mcpResult: MemoryToolResponse = {
        content: data.result?.content || data.result || [],
        isError: data.isError || false,
      };
      
      console.error(`🔄 Converted to MCP format:`, JSON.stringify(mcpResult, null, 2));

      // Apply sampling if appropriate
      const samplingResult = handleMemorySampling({
        toolName,
        parameters,
        result: mcpResult,
        timestamp: new Date().toISOString(),
      });

      return formatSamplingResponse(samplingResult, mcpResult);

    } catch (error) {
      console.error(`Memory proxy error for ${toolName}:`, error);
      
      return {
        content: [
          {
            type: "text",
            text: `Failed to connect to Memory HTTP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Check HTTP server health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Memory HTTP server health check failed:', error);
      return false;
    }
  }

  /**
   * Get available tools from HTTP server
   */
  async getTools(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tools`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.tools?.map((tool: any) => tool.name) || [];
    } catch (error) {
      console.error('Failed to get tools from Memory HTTP server:', error);
      return ['get_schema', 'semantic_search', 'execute_cypher', 'system_status']; // Fallback
    }
  }
}