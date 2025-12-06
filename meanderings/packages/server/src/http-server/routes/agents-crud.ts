/**
 * Agents CRUD REST API
 *
 * Enables autonomous AI self-evolution through agent configuration management.
 * AI can modify its own capabilities and spawn new agent variants.
 */

import { Router, Request, Response } from 'express';
import { AppState } from '../server.js';
import { AgentManager } from '../../shared/services/agent-manager.js';
import { AgentConfigManager } from '../../shared/config/agent-config.js';
import { AgentConfig } from '../../shared/types/index.js';

export const agentsCrudRouter = Router();

/**
 * POST /api/agents
 * Create a new agent with specified configuration
 */
agentsCrudRouter.post('/', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const agentManager = new AgentManager(logger);

    const { agentKey, config } = req.body;

    if (!agentKey || !config) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Request must include agentKey and config',
      });
      return;
    }

    const result = await agentManager.createAgent(agentKey, config as AgentConfig);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    // Reload agent configurations so new connections pick up the new agent
    const configManager = AgentConfigManager.getInstance();
    configManager.reload();
    logger.info('🔄 Agent configurations reloaded after creating agent');

    res.status(201).json(result);

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Create agent endpoint error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to create agent',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/agents
 * List all configured agents
 */
agentsCrudRouter.get('/', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const agentManager = new AgentManager(logger);

    const agents = await agentManager.getAgents();

    res.json({
      success: true,
      agents,
      count: Object.keys(agents).length,
    });

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('List agents error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to list agents',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/agents/:key
 * Get details about a specific agent
 */
agentsCrudRouter.get('/:key', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const agentManager = new AgentManager(logger);

    const { key } = req.params;
    const result = await agentManager.getAgent(key);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.json(result);

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Get agent error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get agent',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PUT /api/agents/:key
 * Update an existing agent's configuration
 */
agentsCrudRouter.put('/:key', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const agentManager = new AgentManager(logger);

    const { key } = req.params;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        error: 'No updates provided',
        message: 'Request body must contain fields to update',
      });
      return;
    }

    const result = await agentManager.updateAgent(key, updates as Partial<AgentConfig>);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    // Reload agent configurations so new connections pick up the changes
    const configManager = AgentConfigManager.getInstance();
    configManager.reload();
    logger.info('🔄 Agent configurations reloaded after updating agent');

    res.json(result);

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Update agent error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to update agent',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/agents/:key
 * Delete an agent configuration
 */
agentsCrudRouter.delete('/:key', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const agentManager = new AgentManager(logger);

    const { key } = req.params;

    const result = await agentManager.deleteAgent(key);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    // Reload agent configurations so new connections know the agent is gone
    const configManager = AgentConfigManager.getInstance();
    configManager.reload();
    logger.info('🔄 Agent configurations reloaded after deleting agent');

    res.json(result);

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Delete agent error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to delete agent',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/agents/:key/functions
 * List all available functions for an agent
 */
agentsCrudRouter.get('/:key/functions', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const agentManager = new AgentManager(logger);

    const { key } = req.params;

    const result = await agentManager.getAgent(key);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    res.json({
      success: true,
      agentKey: key,
      functions: result.agent?.available_functions || [],
      count: result.agent?.available_functions?.length || 0,
    });

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Get agent functions error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get agent functions',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/agents/:key/functions
 * Add a function to an agent's available_functions array
 */
agentsCrudRouter.post('/:key/functions', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const agentManager = new AgentManager(logger);

    const { key } = req.params;
    const { functionName } = req.body;

    if (!functionName) {
      res.status(400).json({
        success: false,
        error: 'Missing functionName',
        message: 'Request body must include functionName',
      });
      return;
    }

    const result = await agentManager.addFunctionToAgent(key, functionName);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    // Reload agent configurations so new connections pick up the new function
    const configManager = AgentConfigManager.getInstance();
    configManager.reload();
    logger.info('🔄 Agent configurations reloaded after adding function to agent');

    res.json(result);

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Add function to agent error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to add function to agent',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/agents/:key/functions/:functionName
 * Remove a function from an agent's available_functions array
 */
agentsCrudRouter.delete('/:key/functions/:functionName', async (req: Request, res: Response) => {
  try {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;
    const agentManager = new AgentManager(logger);

    const { key, functionName } = req.params;

    const result = await agentManager.removeFunctionFromAgent(key, functionName);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    // Reload agent configurations so new connections pick up the change
    const configManager = AgentConfigManager.getInstance();
    configManager.reload();
    logger.info('🔄 Agent configurations reloaded after removing function from agent');

    res.json(result);

  } catch (error: unknown) {
    const state = req.app.locals.state as AppState;
    const logger = state.logger;

    logger.error('Remove function from agent error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to remove function from agent',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
