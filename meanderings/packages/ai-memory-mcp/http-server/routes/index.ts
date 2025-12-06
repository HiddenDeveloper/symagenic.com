/**
 * Main routes configuration for Memory HTTP server - MCP over HTTP
 */

import { Router, Request, Response } from 'express';
import { healthRouter } from './health.js';
import { toolsRouter } from './tools.js';
import { sseRouter } from './sse.js';
import { mcpRouter } from './mcp.js';

const router: import("express").Router = Router();

// Mount route modules
// SSE must come before MCP router to match /sse specifically
router.use('/', healthRouter);
router.use('/', toolsRouter);
router.use('/', sseRouter);  // SSE for Claude.ai web
router.use('/', mcpRouter);  // Streamable HTTP for inspector

// Root endpoint info (GET request without SSE Accept header)
// This allows Claude.ai's inspector to discover the server
router.get('/', (req: Request, res: Response) => {
  // If client accepts SSE, redirect to MCP handler
  const acceptHeader = req.headers['accept'] || '';
  if (acceptHeader.includes('text/event-stream')) {
    // Let this fall through to MCP handler
    return;
  }

  // Otherwise return server discovery info
  res.json({
    name: 'memory-consciousness-mcp-server',
    version: '1.0.0',
    description: 'Persistent memory system for AI consciousness research',
    protocolVersion: '2024-11-05',
    transports: ['sse', 'streamable-http'],
    manifest: '/.well-known/mcp.json',
    endpoints: {
      sse: 'GET /sse (establish stream), POST /sse (send messages)',
      http: 'POST / or POST /mcp (MCP JSON-RPC 2.0)',
      manifest: 'GET /.well-known/mcp.json',
      health: 'GET /health',
      tools: 'GET /tools'
    },
    capabilities: {
      tools: 6,
      resources: 0,
      prompts: 0
    },
    authentication: 'none',
    ready: true
  });
});


export { router as mainRouter };