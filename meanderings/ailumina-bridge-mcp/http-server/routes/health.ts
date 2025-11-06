/**
 * Health check routes for Ailumina Bridge HTTP server
 */

import { Router } from 'express';
import { AiluminaStatusTool } from '../../shared/tools/ailumina-status.js';

const router: import("express").Router = Router();
const statusTool = new AiluminaStatusTool();

router.get('/health', async (req, res) => {
  try {
    const result = await statusTool.execute();
    
    const isHealthy = !result.isError;
    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'ailumina-bridge-http-server',
      timestamp: new Date().toISOString(),
      details: result.content[0]?.text || 'Unknown status'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'ailumina-bridge-http-server',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/health/websocket', async (req, res) => {
  try {
    // TODO: Add WebSocket connection health check
    res.json({
      websocket: {
        status: 'unknown',
        message: 'WebSocket health check not yet implemented'
      }
    });
  } catch (error) {
    res.status(500).json({
      websocket: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export { router as healthRouter };