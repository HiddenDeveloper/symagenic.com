/**
 * MCP JSON-RPC 2.0 route for Qdrant Facts HTTP server
 */

import { Router } from 'express';
import { toolRegistry } from '../../shared/tools/index.js';

const router: import("express").Router = Router();

// MCP JSON-RPC 2.0 endpoint
router.post('/', async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  // Validate JSON-RPC 2.0 format
  if (jsonrpc !== '2.0') {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request',
        data: 'jsonrpc version must be "2.0"'
      },
      id: id || null
    });
    return;
  }

  try {
    switch (method) {
      case 'initialize': {
        // MCP protocol initialization
        res.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {}
            },
            serverInfo: {
              name: 'qdrant-facts-mcp',
              version: '1.0.0'
            }
          },
          id
        });
        break;
      }

      case 'tools/list': {
        const tools = toolRegistry.listTools();
        res.json({
          jsonrpc: '2.0',
          result: {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          },
          id
        });
        break;
      }

      case 'tools/call': {
        const { name: toolName, arguments: toolArgs = {} } = params || {};

        if (!toolName) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Invalid params',
              data: 'Tool name is required'
            },
            id
          });
          return;
        }

        const tool = toolRegistry.getTool(toolName);
        if (!tool) {
          res.status(404).json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: 'Method not found',
              data: `Tool "${toolName}" not found`
            },
            id
          });
          return;
        }

        const result = await tool.handler(toolArgs);
        res.json({
          jsonrpc: '2.0',
          result,
          id
        });
        break;
      }

      default: {
        res.status(404).json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Method "${method}" not supported`
          },
          id
        });
      }
    }
  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      },
      id
    });
  }
});

export { router as mcpRouter };
