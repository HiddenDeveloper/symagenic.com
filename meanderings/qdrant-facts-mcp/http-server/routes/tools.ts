/**
 * Tools routes for Qdrant Facts HTTP server
 */

import { Router } from 'express';
import { toolRegistry } from '../../shared/tools/index.js';

const router: import("express").Router = Router();

// List all available tools
router.get('/tools', (req, res) => {
  const tools = toolRegistry.listTools();
  res.json({
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  });
});

// Execute a specific tool
router.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const { parameters = {} } = req.body;

  try {
    const tool = toolRegistry.getTool(toolName);
    if (!tool) {
      res.status(404).json({
        error: 'Tool not found',
        tool: toolName,
        available: toolRegistry.listTools().map(t => t.name)
      });
      return;
    }

    const result = await tool.handler(parameters);
    res.json(result);
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    res.status(500).json({
      error: 'Tool execution failed',
      tool: toolName,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as toolsRouter };
