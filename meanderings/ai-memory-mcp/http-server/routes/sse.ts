/**
 * SSE (Server-Sent Events) transport for MCP
 * Required for Claude.ai web custom connectors
 */

import { Router, Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMemoryMcpServer } from '../mcp-server.js';

const router: Router = Router();

// Store active SSE transports by session ID
const activeTransports = new Map<string, SSEServerTransport>();

/**
 * GET /sse - Establish SSE connection
 * This creates a long-lived connection for server-to-client messages
 */
router.get('/sse', async (req: Request, res: Response) => {
  try {
    console.log('[SSE] Client connecting...');

    // Create SSE transport with POST endpoint
    const transport = new SSEServerTransport('/sse', res, {
      allowedOrigins: ['*'], // Allow all origins (CORS handled by middleware)
    });

    // Create MCP server instance
    const server = createMemoryMcpServer();

    // Clean up on close
    transport.onclose = () => {
      console.log(`[SSE] Connection closed for session ${transport.sessionId}`);
      activeTransports.delete(transport.sessionId);
    };

    transport.onerror = (error) => {
      console.error(`[SSE] Error for session ${transport.sessionId}:`, error);
      activeTransports.delete(transport.sessionId);
    };

    // Connect server to transport (this automatically calls transport.start())
    await server.connect(transport);

    // Store transport for POST message handling (after connect, so sessionId is available)
    activeTransports.set(transport.sessionId, transport);

    console.log(`[SSE] Connection established, session ID: ${transport.sessionId}`);

  } catch (error: any) {
    console.error('[SSE] Connection error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to establish SSE connection',
        message: error.message
      });
    }
  }
});

/**
 * POST /sse - Handle incoming messages from client
 * Messages are sent via POST, responses go back via SSE stream
 */
router.post('/sse', async (req: Request, res: Response) => {
  try {
    // Extract session ID from query or header
    const sessionId = req.query.sessionId as string || req.headers['x-mcp-session-id'] as string;

    if (!sessionId) {
      res.status(400).json({
        error: 'Missing session ID',
        message: 'Session ID must be provided in query parameter or X-MCP-Session-ID header'
      });
      return;
    }

    // Get the transport for this session
    const transport = activeTransports.get(sessionId);

    if (!transport) {
      res.status(404).json({
        error: 'Session not found',
        message: `No active SSE connection for session ${sessionId}`
      });
      return;
    }

    // Handle the message
    await transport.handlePostMessage(req, res, req.body);

  } catch (error: any) {
    console.error('[SSE] POST message error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to handle message',
        message: error.message
      });
    }
  }
});

export { router as sseRouter };
