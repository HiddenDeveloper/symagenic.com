/**
 * MCP protocol endpoints using official SDK StreamableHTTPServerTransport
 * Supports both Claude.ai web and mobile apps
 */

import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMemoryMcpServer } from '../mcp-server.js';

const router: import("express").Router = Router();

/**
 * MCP protocol handler function
 * Handles all MCP protocol communication using the official SDK.
 */
async function handleMcpRequest(req: Request, res: Response) {
  try {
    // Create a new transport for this request (stateless mode)
    // This prevents request ID collisions between different clients
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode - no sessions
      enableJsonResponse: true, // Enable JSON responses for better compatibility
    });

    // Create the MCP server instance with all registered tools
    const server = createMemoryMcpServer();

    // Clean up transport when response closes
    res.on('close', () => {
      transport.close();
    });

    // Connect server to transport
    await server.connect(transport);

    // Handle the incoming request
    await transport.handleRequest(req, res, req.body);

  } catch (error: any) {
    console.error('MCP transport error:', error);

    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error.message
        },
        id: null
      });
    }
  }
}

// Register POST handlers for sending messages
router.post('/', handleMcpRequest);
router.post('/mcp', handleMcpRequest);
router.post('/sse', handleMcpRequest);
router.post('/messages', handleMcpRequest);

// Register GET handlers for SSE streaming (required by Claude.ai web)
// Note: GET / is handled by the info endpoint in index.ts for discovery
router.get('/mcp', handleMcpRequest);
router.get('/sse', handleMcpRequest);
router.get('/messages', handleMcpRequest);

export { router as mcpRouter };