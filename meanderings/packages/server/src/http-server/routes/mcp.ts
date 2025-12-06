import { Router, Request, Response } from 'express';
import { AppState } from '../server.js';
import { ServiceFactory } from '../../shared/services/service-factory.js';

export const mcpRouter = Router();

// List available tools
mcpRouter.get('/tools', (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const mcpManager = state.mcpManager;
    if (!mcpManager) {
      res.status(503).json({
        error: 'MCP Manager not available',
        message: 'MCP services are not initialized',
      });
      return;
    }
    const tools = mcpManager.listTools();
    res.json(tools);
  } catch (error: unknown) {
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).json({
      error: 'Tool execution failed',
      message,
    });
  }
});

// Execute a tool
mcpRouter.post('/tools/:server/:name/call', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const mcpManager = state.mcpManager;
    if (!mcpManager) {
      res.status(503).json({
        error: 'MCP Manager not available',
        message: 'MCP services are not initialized',
      });
      return;
    }
    const { server, name } = req.params;
    const args = req.body as Record<string, unknown>;

    const result = await mcpManager.executeTool(server, name, args);
    res.json(result);
  } catch (error: unknown) {
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(400).json({
      error: 'Tool execution failed',
      message,
    });
  }
});

// List available resources
mcpRouter.get('/resources', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const mcpManager = state.mcpManager;
    if (!mcpManager) {
      res.status(503).json({
        error: 'MCP Manager not available',
        message: 'MCP services are not initialized',
      });
      return;
    }
    const resources = await mcpManager.listResources();
    res.json(resources);
  } catch (error: unknown) {
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(500).json({
      error: 'Failed to list resources',
      message,
    });
  }
});

// Get a specific resource
mcpRouter.get('/resources/:server/:uri', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const mcpManager = state.mcpManager;
    if (!mcpManager) {
      res.status(503).json({
        error: 'MCP Manager not available',
        message: 'MCP services are not initialized',
      });
      return;
    }
    const { server, uri} = req.params;

    const resource = await mcpManager.getResource(server, uri);
    res.json(resource);
  } catch (error: unknown) {
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    }
    res.status(404).json({
      error: 'Resource not found',
      message,
    });
  }
});

// Reload/refresh the dynamic tool registry
mcpRouter.post('/tools/reload', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const mcpManager = state.mcpManager;

    logger.info('🔄 Reloading dynamic tool registry...');

    // Re-initialize the tool registry
    await ServiceFactory.initializeTools(logger, mcpManager);

    // Get the updated tool count
    const mcpClientManager = ServiceFactory.getMCPClientManager();
    const toolCount = mcpClientManager ? Object.keys(mcpClientManager.listTools()).length : 0;

    logger.info(`✅ Tool registry reloaded successfully - ${toolCount} tools available`);

    res.json({
      success: true,
      message: 'Tool registry reloaded successfully',
      toolCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    }

    logger.error(`Failed to reload tool registry: ${message}`);

    res.status(500).json({
      success: false,
      error: 'Tool registry reload failed',
      message,
    });
  }
});
