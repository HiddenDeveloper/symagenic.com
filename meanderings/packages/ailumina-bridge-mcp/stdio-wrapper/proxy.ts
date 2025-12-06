/**
 * HTTP proxy for Ailumina Bridge STDIO wrapper
 */

import fetch from 'node-fetch';
import { AILUMINA_STDIO_CONFIG } from './config/settings.js';
import { handleAiluminaSampling, formatSamplingResponse } from './sampling/handlers.js';
import type { AiluminaToolResponse } from '../shared/types.js';

export class AiluminaHttpProxy {
  private baseUrl: string;
  private authToken: string;

  constructor() {
    this.baseUrl = AILUMINA_STDIO_CONFIG.httpServerUrl;
    this.authToken = AILUMINA_STDIO_CONFIG.authToken;
  }

  /**
   * Execute a tool via HTTP proxy with sampling
   */
  async executeTool(toolName: string, parameters: any): Promise<AiluminaToolResponse> {
    try {
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
      
      // Convert HTTP response to MCP format
      const mcpResult: AiluminaToolResponse = {
        content: data.result || [],
        isError: data.isError || false,
      };

      // Apply sampling if appropriate
      const samplingResult = handleAiluminaSampling({
        toolName,
        parameters,
        result: mcpResult,
        timestamp: new Date().toISOString(),
      });

      return formatSamplingResponse(samplingResult, mcpResult);

    } catch (error) {
      console.error(`Ailumina Bridge proxy error for ${toolName}:`, error);
      
      return {
        content: [
          {
            type: "text",
            text: `Failed to connect to Ailumina Bridge HTTP server: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      console.error('Ailumina Bridge HTTP server health check failed:', error);
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
      console.error('Failed to get tools from Ailumina Bridge HTTP server:', error);
      return ['echo', 'calculate', 'get_time', 'ailumina_status', 'ailumina_chat']; // Fallback
    }
  }
}