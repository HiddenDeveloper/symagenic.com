/**
 * Main routes configuration for Ailumina Bridge HTTP server
 */

import { Router } from 'express';
import { healthRouter } from './health.js';
import { toolsRouter } from './tools.js';
import { mcpRouter } from './mcp.js';

const router: import("express").Router = Router();

// Mount route modules
router.use('/', healthRouter);
router.use('/', toolsRouter);
router.use('/', mcpRouter);

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'ailumina-bridge-http-server',
    version: '1.0.0',
    description: 'HTTP server for Ailumina Bridge AI communication system',
    endpoints: {
      health: '/health',
      tools: '/tools',
      mcp: '/ (POST with JSON-RPC 2.0)',
      documentation: '/tools (GET for list, POST for execution)'
    },
    architecture: 'dual-transport',
    transport: 'HTTP',
    sampling: 'Not supported (use STDIO wrapper)',
    mcp_support: 'Full MCP protocol via JSON-RPC 2.0',
    websocket_backend: 'Ailumina FastAPI system'
  });
});

export { router as mainRouter };