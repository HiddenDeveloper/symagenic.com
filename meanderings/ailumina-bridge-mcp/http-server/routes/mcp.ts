/**
 * MCP protocol endpoints for HTTP transport
 */

import { Router, Request, Response } from 'express';
import { AILUMINA_TOOLS } from '../../shared/tools/index.js';

const router: import("express").Router = Router();

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: {
    tools?: {};
    resources?: {};
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

// MCP initialization endpoint
router.post('/', async (req: Request, res: Response) => {
  try {
    const mcpRequest: MCPRequest = req.body;
    
    if (mcpRequest.method === 'initialize') {
      const params = mcpRequest.params as MCPInitializeParams;
      
      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result: {
          protocolVersion: '2024-11-05',
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
            name: 'ailumina-bridge-http-server',
            version: '1.0.0'
          }
        }
      };
      
      res.json(response);
      return;
    }
    
    if (mcpRequest.method === 'notifications/initialized') {
      // This is a notification - no response expected
      // Just acknowledge receipt
      res.status(200).end();
      return;
    }
    
    if (mcpRequest.method === 'tools/list') {
      const availableTools = Object.entries(AILUMINA_TOOLS).map(([name, tool]) => ({
        name,
        description: getToolDescription(name),
        inputSchema: getToolInputSchema(name)
      }));
      
      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result: {
          tools: availableTools
        }
      };
      
      res.json(response);
      return;
    }
    
    if (mcpRequest.method === 'tools/call') {
      const { name, arguments: args } = mcpRequest.params;
      
      const tool = AILUMINA_TOOLS[name as keyof typeof AILUMINA_TOOLS];
      if (!tool) {
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          error: {
            code: -32601,
            message: `Tool not found: ${name}`
          }
        };
        res.status(404).json(response);
        return;
      }
      
      try {
        const result = await tool.execute(args || {});
        
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: {
            content: result.content,
            isError: result.isError || false
          }
        };
        
        res.json(response);
      } catch (error: any) {
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          error: {
            code: -32603,
            message: error.message || 'Tool execution failed'
          }
        };
        res.status(500).json(response);
      }
      return;
    }
    
    // Unknown method
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: mcpRequest.id,
      error: {
        code: -32601,
        message: `Method not found: ${mcpRequest.method}`
      }
    };
    res.status(404).json(response);
    
  } catch (error: any) {
    console.error('MCP endpoint error:', error);
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: req.body?.id || 'unknown',
      error: {
        code: -32700,
        message: 'Parse error'
      }
    };
    res.status(400).json(response);
  }
});

// Helper functions for tool metadata
function getToolDescription(toolName: string): string {
  const descriptions: Record<string, string> = {
    'echo': 'Echo back the provided text',
    'calculate': 'Perform basic arithmetic calculations',
    'get_time': 'Get the current server time',
    'ailumina_status': 'Get the status of the Ailumina bridge server',
    'ailumina_chat': 'Send a message to the Ailumina agent system and get a response',
    'list_agents': 'List all available Ailumina agents with their configurations',
    'reload_tools': 'Hot-reload the tool registry to discover newly created tools. Essential for AI self-evolution - call this after creating new tools to make them immediately available.'
  };
  return descriptions[toolName] || 'Unknown tool';
}

function getToolInputSchema(toolName: string): any {
  const schemas: Record<string, any> = {
    'echo': {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to echo back'
        }
      },
      required: ['text']
    },
    'calculate': {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate'
        }
      },
      required: ['expression']
    },
    'get_time': {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['iso', 'timestamp', 'human'],
          description: 'Time format (iso, timestamp, human)'
        }
      },
      required: []
    },
    'ailumina_status': {
      type: 'object',
      properties: {},
      required: []
    },
    'list_agents': {
      type: 'object',
      properties: {},
      required: []
    },
    'reload_tools': {
      type: 'object',
      properties: {},
      required: []
    },
    'ailumina_chat': {
      type: 'object',
      properties: {
        agent_type: {
          type: 'string',
          enum: ['crud', 'news', 'collaborator', 'ailumina'],
          description: 'Type of Ailumina agent to communicate with'
        },
        user_input: {
          type: 'string',
          description: 'The message to send to the agent'
        },
        chat_messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' }
            }
          },
          description: 'Complete conversation history to maintain context'
        },
        fileId: {
          type: 'string',
          description: 'Optional file ID for file upload context'
        },
        server_url: {
          type: 'string',
          description: 'Ailumina server WebSocket URL'
        }
      },
      required: ['agent_type', 'user_input']
    }
  };
  
  return schemas[toolName] || {
    type: 'object',
    properties: {},
    required: []
  };
}

export { router as mcpRouter };