/**
 * Tool registry and exports
 */

import { Tool, ToolHandler } from "../types.js";
import { echoToolDefinition, executeEchoTool } from "./echo.js";
import { timeToolDefinition, executeTimeTool } from "./time.js";
import { calculatorToolDefinition, executeCalculatorTool } from "./calculator.js";
import { weatherToolDefinition, executeWeatherTool } from "./weather.js";

/**
 * Registry of all available tools
 */
export const toolDefinitions: Tool[] = [
  echoToolDefinition,
  timeToolDefinition,
  calculatorToolDefinition,
  weatherToolDefinition,
];

/**
 * Map of tool names to their handlers
 */
export const toolHandlers: Record<string, ToolHandler> = {
  echo: executeEchoTool,
  get_time: executeTimeTool,
  calculate: executeCalculatorTool,
  get_weather: executeWeatherTool,
};

/**
 * Execute a tool by name
 */
export async function executeTool(name: string, args: unknown) {
  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  
  return await handler(args);
}

/**
 * Get tool definition by name
 */
export function getToolDefinition(name: string): Tool | undefined {
  return toolDefinitions.find(tool => tool.name === name);
}

/**
 * Re-export individual tools for direct import
 */
export {
  echoToolDefinition,
  executeEchoTool,
  timeToolDefinition,
  executeTimeTool,
  calculatorToolDefinition,
  executeCalculatorTool,
  weatherToolDefinition,
  executeWeatherTool,
};