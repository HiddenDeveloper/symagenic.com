/**
 * Main routes configuration for Recall HTTP server - MCP over HTTP
 */

import { Router } from 'express';
import { healthRouter } from './health.js';
import { mcpRouter } from './mcp.js';

const router: import("express").Router = Router();

// Mount route modules
router.use('/', healthRouter);
router.use('/', mcpRouter);

// Root endpoint info (GET request)
router.get('/', (req, res) => {
  res.json({
    service: 'ai-recall-mcp',
    version: '1.0.0',
    description: 'Conversation history recall with semantic search over Qdrant',
    protocolVersion: '2024-11-05',
    architecture: 'dual-transport',
    transport: 'MCP-over-HTTP',
    endpoints: {
      mcp: 'POST /mcp (JSON-RPC 2.0)',
      health: 'GET /health'
    },
    capabilities: {
      tools: ['get_schema', 'semantic_search', 'text_search', 'system_status'],
      resources: [],
      sampling: false
    },
    qdrant: {
      collection: 'conversation-turns',
      vectorDimensions: 1024,
      embeddingModel: 'multilingual-e5-large'
    }
  });
});

export { router as mainRouter };
