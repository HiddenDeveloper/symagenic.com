/**
 * Health check route for Recall system
 */

import { Router, type Router as IRouter } from 'express';
import { RECALL_HTTP_CONFIG } from '../config/settings.js';

export const healthRouter: IRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-recall-mcp',
    description: 'Conversation history recall with semantic search',
    qdrant: {
      url: RECALL_HTTP_CONFIG.qdrant.url,
      collection: RECALL_HTTP_CONFIG.qdrant.collection,
    },
    timestamp: new Date().toISOString(),
  });
});
