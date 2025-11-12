/**
 * MCP JSON-RPC message handler for Recall (conversation history search) system
 */

import { RECALL_TOOLS } from '../../shared/tools/index.js';
import { RECALL_HTTP_CONFIG } from '../config/settings.js';
import type { QdrantConfig } from '../../shared/types.js';

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

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export class MCPHandler {
  private config: QdrantConfig;

  constructor() {
    this.config = {
      url: RECALL_HTTP_CONFIG.qdrant.url,
      collection: RECALL_HTTP_CONFIG.qdrant.collection,
    };
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const requestId = request.id ?? null;

    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(requestId);

        case 'tools/list':
          return this.handleToolsList(requestId);

        case 'tools/call':
          return await this.handleToolsCall(requestId, request.params);

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

  private handleInitialize(id: string | number | null): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {}
        },
        serverInfo: {
          name: 'recall-conversation-history',
          version: '1.0.0',
          description: 'Conversation history recall system with semantic search over Qdrant vector database'
        }
      }
    };
  }

  private handleToolsList(id: string | number | null): MCPResponse {
    const tools = [
      {
        name: 'get_schema',
        description: 'View collection schema and metadata - Call first to understand available filters and search capabilities',
        inputSchema: {
          type: 'object',
          properties: {
            include_statistics: {
              type: 'boolean',
              description: 'Include collection statistics (total turns, indexed vectors)',
              default: true
            }
          }
        }
      },
      {
        name: 'semantic_search',
        description: 'Semantic search over conversation history - Find relevant past conversations by meaning',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query text (will be embedded automatically)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 10
            },
            threshold: {
              type: 'number',
              description: 'Minimum similarity score (0.0-1.0)',
              default: 0.7
            },
            filters: {
              type: 'object',
              description: 'Optional filters: provider, date_time range, role, etc.',
              additionalProperties: true
            }
          },
          required: ['query']
        }
      },
      {
        name: 'text_search',
        description: 'Keyword-based metadata search - Search by exact text in conversation metadata',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Text query to search for in metadata'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Fields to search (text, conversation_title, provider, etc.)'
            },
            provider: {
              type: 'string',
              description: 'Filter by AI provider (chatgpt, claude, OpenAI)'
            },
            date_from: {
              type: 'string',
              description: 'Start date (ISO 8601 format)'
            },
            date_to: {
              type: 'string',
              description: 'End date (ISO 8601 format)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'system_status',
        description: 'Check Recall system health - Verify Qdrant connection and collection status',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];

    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools
      }
    };
  }

  private async handleToolsCall(id: string | number | null, params: any): Promise<MCPResponse> {
    const { name, arguments: args } = params || {};

    if (!name) {
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

    const tool = RECALL_TOOLS[name as keyof typeof RECALL_TOOLS];
    if (!tool) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: `Tool '${name}' not found`
        }
      };
    }

    try {
      const result = await tool.execute(this.config, args || {});
      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Tool execution failed',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}
