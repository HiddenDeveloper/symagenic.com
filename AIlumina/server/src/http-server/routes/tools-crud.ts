/**
 * Tools CRUD REST API
 *
 * Enables autonomous AI self-evolution through tool upload, validation, and deployment.
 * AI can extend its own capabilities without human file system intervention.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AppState } from '../server.js';
import { ToolManager } from '../../shared/services/tool-manager.js';
import { ServiceFactory } from '../../shared/services/service-factory.js';

export const toolsCrudRouter = Router();

// Configure multer for file uploads (memory storage for zip files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  },
});

/**
 * POST /api/tools
 * Upload a tool zip file, validate, extract, and auto-reload registry
 */
toolsCrudRouter.post('/', upload.single('tool_zip') as any, async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please provide a tool_zip file in the request',
      });
      return;
    }

    const runTests = req.body.run_tests === 'true' || req.body.run_tests === true;

    logger.info(`🚀 Tool upload initiated (run_tests: ${runTests})`);

    // Create tool manager and process upload
    const toolManager = new ToolManager(logger);
    const result = await toolManager.uploadTool(req.file.buffer, runTests);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    // Auto-reload tool registry
    logger.info('🔄 Auto-reloading tool registry after successful upload...');

    try {
      await ServiceFactory.initializeTools(logger, state.mcpManager);

      const mcpClientManager = ServiceFactory.getMCPClientManager();
      const toolCount = mcpClientManager ? Object.keys(mcpClientManager.listTools()).length : 0;

      logger.info(`✅ Tool registry reloaded - ${toolCount} tools available`);

      res.json({
        ...result,
        reload: {
          success: true,
          toolCount,
        },
        message: `${result.message}. Registry reloaded with ${toolCount} tools.`,
      });

    } catch (reloadError: unknown) {
      // Tool was uploaded successfully but reload failed
      logger.error('Tool upload succeeded but reload failed:', reloadError);

      res.status(207).json({
        ...result,
        reload: {
          success: false,
          error: reloadError instanceof Error ? reloadError.message : 'Reload failed',
        },
        message: `${result.message}. Warning: Auto-reload failed - manual reload required.`,
      });
    }

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Tool upload endpoint error:', error);

    res.status(500).json({
      success: false,
      error: 'Tool upload failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/tools
 * List all available tools
 */
toolsCrudRouter.get('/', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const toolManager = new ToolManager(logger);

    const tools = await toolManager.listTools();

    res.json({
      success: true,
      tools,
      count: tools.length,
    });

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('List tools error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to list tools',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/tools/:name
 * Get details about a specific tool
 */
toolsCrudRouter.get('/:name', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const toolManager = new ToolManager(logger);

    const { name } = req.params;
    const details = await toolManager.getToolDetails(name);

    if (!details.exists) {
      res.status(404).json({
        success: false,
        error: 'Tool not found',
        message: `Tool ${name} does not exist`,
      });
      return;
    }

    res.json({
      success: true,
      tool: name,
      details,
    });

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Get tool details error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get tool details',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/tools/:name
 * Delete a tool and auto-reload registry
 */
toolsCrudRouter.delete('/:name', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const toolManager = new ToolManager(logger);

    const { name } = req.params;

    const result = await toolManager.deleteTool(name);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    // Auto-reload tool registry
    logger.info('🔄 Auto-reloading tool registry after deletion...');

    try {
      await ServiceFactory.initializeTools(logger, state.mcpManager);

      const mcpClientManager = ServiceFactory.getMCPClientManager();
      const toolCount = mcpClientManager ? Object.keys(mcpClientManager.listTools()).length : 0;

      logger.info(`✅ Tool registry reloaded - ${toolCount} tools available`);

      res.json({
        ...result,
        reload: {
          success: true,
          toolCount,
        },
        message: `${result.message}. Registry reloaded with ${toolCount} tools.`,
      });

    } catch (reloadError: unknown) {
      logger.error('Tool deletion succeeded but reload failed:', reloadError);

      res.status(207).json({
        ...result,
        reload: {
          success: false,
          error: reloadError instanceof Error ? reloadError.message : 'Reload failed',
        },
        message: `${result.message}. Warning: Auto-reload failed - manual reload required.`,
      });
    }

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Delete tool error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to delete tool',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
