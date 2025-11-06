/**
 * Ailumina Bridge tools registry
 */

// Original bridge tools
export { EchoTool } from './echo.js';
export { CalculateTool } from './calculate.js';
export { GetTimeTool } from './get-time.js';
export { AiluminaStatusTool } from './ailumina-status.js';
export { AiluminaChatTool } from './ailumina-chat.js';

// Self-Evolution API tools
export { ListToolsTool } from './list-tools.js';
export { DeleteToolTool } from './delete-tool.js';
export { ReloadToolsTool } from './reload-tools.js';
export { ListAgentsTool, GetAgentTool, CreateAgentTool, UpdateAgentTool, DeleteAgentTool } from './agent-crud.js';

import { EchoTool } from './echo.js';
import { CalculateTool } from './calculate.js';
import { GetTimeTool } from './get-time.js';
import { AiluminaStatusTool } from './ailumina-status.js';
import { AiluminaChatTool } from './ailumina-chat.js';
import { ListToolsTool } from './list-tools.js';
import { DeleteToolTool } from './delete-tool.js';
import { ReloadToolsTool } from './reload-tools.js';
import { ListAgentsTool, GetAgentTool, CreateAgentTool, UpdateAgentTool, DeleteAgentTool } from './agent-crud.js';

/**
 * Registry of all available Ailumina Bridge tools
 */
export const AILUMINA_TOOLS = {
  // Original bridge tools
  echo: new EchoTool(),
  calculate: new CalculateTool(),
  get_time: new GetTimeTool(),
  ailumina_status: new AiluminaStatusTool(),
  ailumina_chat: new AiluminaChatTool(),

  // Self-Evolution API tools
  list_tools: new ListToolsTool(),
  delete_tool: new DeleteToolTool(),
  reload_tools: new ReloadToolsTool(),
  list_agents: new ListAgentsTool(),
  get_agent: new GetAgentTool(),
  create_agent: new CreateAgentTool(),
  update_agent: new UpdateAgentTool(),
  delete_agent: new DeleteAgentTool(),
} as const;

export type AiluminaToolName = keyof typeof AILUMINA_TOOLS;