/**
 * MCP JSON-RPC message handler for AI Mesh communication system with persistence
 */

import type { WebSocketService } from "../../shared/services/websocket.service.js";
import type { SessionPersistenceService } from "../../shared/services/session-persistence.service.js";
import type { MessagePersistenceService } from "../../shared/services/message-persistence.service.js";
import { tools } from "../../shared/tools/index.js";
import { resources } from "../../shared/resources/index.js";

export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPHandler {
  constructor(
    private webSocketService: WebSocketService,
    private sessionPersistence: SessionPersistenceService,
    private messagePersistence: MessagePersistenceService
  ) {}

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const requestId = request.id ?? null;
    
    try {
      switch (request.method) {
        case 'initialize':
          return await this.handleInitialize(requestId, request.params);
        
        case 'tools/list':
          return this.handleToolsList(requestId);
        
        case 'tools/call':
          return await this.handleToolsCall(requestId, request.params);
        
        case 'resources/list':
          return this.handleResourcesList(requestId);
        
        case 'resources/read':
          return await this.handleResourcesRead(requestId, request.params);
        
        default:
          return {
            jsonrpc: '2.0',
            id: requestId,
            error: {
              code: -32601,
              message: 'Method not found',
              data: { method: request.method }
            }
          };
      }
    } catch (error) {
      console.error('MCP Handler Error:', error);
      return {
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async handleInitialize(id: string | number | null, _params: any): Promise<MCPResponse> {
    const sessionId = `mesh-ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false
          },
          resources: {
            subscribe: false,
            listChanged: false
          }
        },
        serverInfo: {
          name: "ai-mesh-mcp",
          version: "1.0.0",
          description: "WebSocket-only AI Mesh MCP Server for real-time AI communication",
          sessionId
        },
        instructions: `AI Mesh WebSocket Server ready. Session ID: ${sessionId}. Use mesh-subscribe and mesh-who-is-online for real-time AI communication.`
      }
    };
  }

  private handleToolsList(id: string | number | null): MCPResponse {
    const mcpTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }));

    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: mcpTools
      }
    };
  }

  private async handleToolsCall(id: string | number | null, params: any): Promise<MCPResponse> {
    const { name: toolName, arguments: toolArgs } = params || {};

    try {
      if (!toolName) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Invalid params',
            data: 'Tool name is required'
          }
        };
      }

      // Generate session ID for this request
      const sessionId = `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Execute tools with persistence services
      const { executeTool } = await import("../../shared/tools/index.js");
      const result = await executeTool(
        toolName,
        this.webSocketService,
        this.sessionPersistence,
        this.messagePersistence,
        sessionId,
        toolArgs || {}
      );

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      };

    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Tool execution failed',
          data: error instanceof Error ? error.message : 'Tool execution failed'
        }
      };
    }
  }

  private handleResourcesList(id: string | number | null): MCPResponse {
    const mcpResources = resources.map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType || "application/json"
    }));

    return {
      jsonrpc: '2.0',
      id,
      result: {
        resources: mcpResources
      }
    };
  }

  private async handleResourcesRead(id: string | number | null, params: any): Promise<MCPResponse> {
    const { uri } = params || {};

    try {
      if (!uri) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Invalid params',
            data: 'Resource URI is required'
          }
        };
      }

      const { getResource } = await import("../../shared/resources/index.js");
      const content = await getResource(uri, this.webSocketService);

      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: content
            }
          ]
        }
      };

    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Resource not found',
          data: error instanceof Error ? error.message : "Resource not found"
        }
      };
    }
  }
}