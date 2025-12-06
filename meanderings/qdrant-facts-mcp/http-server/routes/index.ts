/**
 * Main routes configuration for Qdrant Facts HTTP server
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

// Root endpoint info (GET request)
router.get('/', (req, res) => {
  res.json({
    service: 'qdrant-facts-mcp-server',
    version: '1.0.0',
    description: 'External facts pool via MCP over HTTP',
    philosophy: 'External knowledge (unverified) separate from internal observations (verified)',
    protocolVersion: '2024-11-05',
    architecture: 'dual-transport',
    transport: 'MCP-over-HTTP',
    sampling: 'Not supported (use STDIO wrapper)',
    endpoints: {
      mcp: 'POST / (JSON-RPC 2.0)',
      tools: 'GET /tools (list), POST /tools/{name} (execute)',
      health: 'GET /health'
    },
    capabilities: {
      tools: ['search_facts', 'get_fact', 'add_fact', 'mark_verified', 'list_collections'],
      resources: [],
      sampling: false
    },
    linking: {
      direction: 'Neo4j → Qdrant (consciousness references facts)',
      forbidden: 'Qdrant → Neo4j (facts do not contaminate consciousness)'
    }
  });
});

export { router as mainRouter };
