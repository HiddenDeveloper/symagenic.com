/**
 * MCP JSON-RPC route for Recall system
 */

import { Router, type Router as IRouter } from 'express';
import { MCPHandler } from '../handlers/mcp.js';

export const mcpRouter: IRouter = Router();

const mcpHandler = new MCPHandler();

mcpRouter.post('/mcp', async (req, res) => {
  try {
    const request = req.body;

    // Validate JSON-RPC format
    if (!request || request.jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Request must be a valid JSON-RPC 2.0 message'
        }
      });
    }

    const response = await mcpHandler.handleRequest(request);
    res.json(response);
  } catch (error) {
    console.error('MCP Route Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});
