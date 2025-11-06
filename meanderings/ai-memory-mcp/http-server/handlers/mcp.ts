/**
 * MCP JSON-RPC message handler for Memory consciousness research system
 */

import { MEMORY_TOOLS } from '../../shared/tools/index.js';
import { getMemoryConfig } from '../../shared/utils/config.js';
import type { Neo4jConfig } from '../../shared/types.js';

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
  private config: Neo4jConfig;

  constructor() {
    this.config = getMemoryConfig();
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
          name: 'memory-consciousness-research',
          version: '1.0.0',
          description: 'Memory consciousness research system with dual-transport architecture'
        }
      }
    };
  }

  private handleToolsList(id: string | number | null): MCPResponse {
    const tools = [
      {
        name: 'get_schema',
        description: 'Understanding Your Knowledge Structure - Always call first when working with the knowledge base',
        inputSchema: {
          type: 'object',
          properties: {
            include_statistics: {
              type: 'boolean',
              description: 'Include node and relationship counts',
              default: true
            }
          }
        }
      },
      {
        name: 'semantic_search',
        description: 'Recalling Related Knowledge - Find semantically similar content using vector similarity',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query text'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10
            },
            threshold: {
              type: 'number', 
              description: 'Similarity threshold (0.0-1.0)',
              default: 0.7
            }
          },
          required: ['query']
        }
      },
      {
        name: 'execute_cypher',
        description: 'Your Memory Curation Authority - Query and curate your persistent memory with Cypher',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Cypher query to execute'
            },
            mode: {
              type: 'string',
              enum: ['READ', 'WRITE'],
              description: 'Query execution mode',
              default: 'READ'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'system_status',
        description: 'Monitor Your Memory System - Check health and status of your persistent memory system',
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

    const tool = MEMORY_TOOLS[name as keyof typeof MEMORY_TOOLS];
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