/**
 * Health check route for Qdrant Facts HTTP server
 */

import { Router } from 'express';
import { FACTS_HTTP_CONFIG } from '../config/settings.js';

const router: import("express").Router = Router();

router.get('/health', async (req, res) => {
  try {
    // Check Qdrant connection
    const qdrantHealthy = await checkQdrantHealth();

    const status = {
      status: qdrantHealthy ? 'healthy' : 'degraded',
      service: 'qdrant-facts-mcp-server',
      version: '1.0.0',
      qdrant: {
        url: FACTS_HTTP_CONFIG.qdrant.url,
        status: qdrantHealthy ? 'connected' : 'disconnected'
      },
      timestamp: new Date().toISOString()
    };

    res.status(qdrantHealthy ? 200 : 503).json(status);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

async function checkQdrantHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${FACTS_HTTP_CONFIG.qdrant.url}/healthz`);
    return response.ok;
  } catch (error) {
    console.error('Qdrant health check failed:', error);
    return false;
  }
}

export { router as healthRouter };
