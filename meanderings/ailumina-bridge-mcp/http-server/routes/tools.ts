/**
 * Tools routes for Ailumina Bridge HTTP server
 */

import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { AILUMINA_TOOLS } from '../../shared/tools/index.js';
import type { AiluminaToolName } from '../../shared/tools/index.js';

const router: ExpressRouter = Router();

// Schema validation for tool requests
const ToolRequestSchema = z.object({
  tool: z.string(),
  parameters: z.record(z.any()).optional().default({}),
});

// Schema for path-based tool requests (tool name comes from URL)
const PathToolRequestSchema = z.object({
  parameters: z.record(z.any()).optional().default({}),
});

// Get list of available tools
router.get('/tools', (req, res) => {
  const tools = Object.keys(AILUMINA_TOOLS).map(name => ({
    name,
    description: getToolDescription(name as AiluminaToolName),
  }));
  
  res.json({ tools });
});

// Execute a specific tool
router.post('/tools/:toolName', async (req, res) => {
  try {
    const { toolName } = req.params;
    const { parameters = {} } = PathToolRequestSchema.parse(req.body);
    
    if (!(toolName in AILUMINA_TOOLS)) {
      return res.status(404).json({
        error: 'Tool not found',
        available_tools: Object.keys(AILUMINA_TOOLS)
      });
    }
    
    const tool = AILUMINA_TOOLS[toolName as AiluminaToolName];
    const result = await tool.execute(parameters as any);
    
    return res.json({
      tool: toolName,
      result: result.content,
      isError: result.isError || false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Tool execution error:', error);
    return res.status(500).json({
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generic tool execution endpoint
router.post('/tools', async (req, res) => {
  try {
    const { tool: toolName, parameters = {} } = ToolRequestSchema.parse(req.body);
    
    if (!(toolName in AILUMINA_TOOLS)) {
      return res.status(404).json({
        error: 'Tool not found',
        available_tools: Object.keys(AILUMINA_TOOLS)
      });
    }
    
    const tool = AILUMINA_TOOLS[toolName as AiluminaToolName];
    const result = await tool.execute(parameters as any);
    
    return res.json({
      tool: toolName,
      result: result.content,
      isError: result.isError || false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Tool execution error:', error);
    return res.status(500).json({
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

function getToolDescription(toolName: AiluminaToolName): string {
  const descriptions = {
    // Original bridge tools
    echo: "Echo back the provided text",
    calculate: "Perform basic arithmetic calculations",
    get_time: "Get the current server time",
    ailumina_status: "Get the status of the Ailumina bridge server",
    ailumina_chat: "Send a message to the Ailumina agent system and get a response",

    // Self-Evolution API tools
    list_tools: "List all available tools in the system",
    delete_tool: "Delete a tool from the system",
    reload_tools: "Hot-reload the tool registry to discover newly created tools",
    list_agents: "List all available Ailumina agents with their configurations",
    get_agent: "Get details about a specific agent",
    create_agent: "Create a new agent with specified configuration",
    update_agent: "Update an existing agent's configuration",
    delete_agent: "Delete an agent configuration",
  };

  return descriptions[toolName] || "Ailumina Bridge tool";
}

export { router as toolsRouter };