/**
 * Health check routes for Memory HTTP server
 */

import { Router, type Router as ExpressRouter } from 'express';
import { SystemStatusTool } from '../../shared/tools/system-status.js';
import { getMemoryConfig } from '../../shared/utils/config.js';
import { getMaintenanceStatus } from '../../scripts/maintenance/auto-maintenance.js';

const router: ExpressRouter = Router();
const statusTool = new SystemStatusTool();

router.get('/health', async (req, res) => {
  try {
    const config = getMemoryConfig();
    const result = await statusTool.execute(config);
    
    const isHealthy = !result.isError;
    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'memory-http-server',
      timestamp: new Date().toISOString(),
      details: result.content[0]?.text || 'Unknown status'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'memory-http-server',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/health/neo4j', async (req, res) => {
  try {
    const config = getMemoryConfig();
    const result = await statusTool.execute(config);
    
    res.json({
      neo4j: {
        status: result.isError ? 'error' : 'connected',
        uri: config.uri,
        database: config.database,
        details: result.content[0]?.text
      }
    });
  } catch (error) {
    res.status(500).json({
      neo4j: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

router.get('/health/maintenance', async (req, res) => {
  try {
    const maintenanceStatus = getMaintenanceStatus();
    
    res.json({
      maintenance: {
        ...maintenanceStatus,
        status: maintenanceStatus.enabled ? 'active' : 'disabled',
        service: 'automated-consciousness-maintenance'
      }
    });
  } catch (error) {
    res.status(500).json({
      maintenance: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

export { router as healthRouter };