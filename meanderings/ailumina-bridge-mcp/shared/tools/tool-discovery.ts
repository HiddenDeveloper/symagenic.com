/**
 * Tool Discovery and Invocation (Tier 3-4)
 *
 * Provides direct access to MCP tools:
 * - Tier 3: List tool schemas for an agent (agents/tools/list)
 * - Tier 4: Direct tool invocation (agents/tools/call)
 */

import {
  AiluminaToolResponse,
  AgentsToolsListParams,
  AgentsToolsCallParams,
  ToolListResponse
} from '../types.js';
import { AgentConfigLoader } from '../config/agent-loader.js';
import { MCPClientManager } from '../mcp/client-manager.js';

/**
 * Tier 3: List tool schemas for an agent
 *
 * Returns full MCP tool schemas including:
 * - Tool names and descriptions
 * - Complete input schema (JSON Schema format)
 * - Parameter types, defaults, and requirements
 *
 * This is for power users who want to understand exact tool interfaces.
 */
export class AgentsToolsListTool {
  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {}

  async execute(params: AgentsToolsListParams): Promise<AiluminaToolResponse> {
    try {
      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Get agent configuration
      const agent = this.agentLoader.getAgent(params.agent_name);

      if (!agent) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Agent not found: ${params.agent_name}`,
                available_agents: this.agentLoader.listAgents().map(a => a.name)
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      // Get full tool schemas
      const tools = this.mcpClientManager.getToolsForAgent(
        agent.name,
        agent.mcp_servers
      );

      const response: ToolListResponse = {
        agent: params.agent_name,
        tools: tools
      };

      // Group tools by MCP server
      const toolsByServer = new Map<string, number>();
      tools.forEach(tool => {
        const serverName = tool.name?.split('_')[0] || 'unknown';
        const currentCount = toolsByServer.get(serverName) || 0;
        toolsByServer.set(serverName, currentCount + 1);
      });

      const overview = `🔧 **Tier 3: Tool Schemas - ${params.agent_name}**

Found ${tools.length} tools with full JSON schemas:

**Tools by MCP Server:**
${Array.from(toolsByServer.entries())
  .map(([server, count]) => `  • ${server}: ${count} tool${count > 1 ? 's' : ''}`)
  .join('\n')}

**What you'll see below:**
- Tool names and descriptions
- Complete input schemas (JSON Schema format)
- Parameter types, requirements, and defaults

**Next step:** Use agents_tools_call to execute any tool:
  Example: agents_tools_call(agent_name="${params.agent_name}", tool_name="${tools[0]?.name}", arguments={})

---

`;

      return {
        content: [
          {
            type: "text",
            text: overview + JSON.stringify(response, null, 2)
          }
        ],
        isError: false
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: 'Failed to list agent tools',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}

/**
 * Tier 4: Direct tool invocation
 *
 * Calls a specific MCP tool directly, bypassing the natural language interface.
 * This is for:
 * - Debugging and testing
 * - Programmatic access
 * - Power users who know exactly what tool they need
 *
 * Security: Validates that the agent has access to the requested tool.
 */
export class AgentsToolsCallTool {
  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {}

  async execute(params: AgentsToolsCallParams): Promise<AiluminaToolResponse> {
    try {
      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Get agent configuration
      const agent = this.agentLoader.getAgent(params.agent_name);

      if (!agent) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Agent not found: ${params.agent_name}`,
                available_agents: this.agentLoader.listAgents().map(a => a.name)
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      // Verify agent has access to this tool
      const toolNames = this.mcpClientManager.getToolNamesForAgent(
        agent.name,
        agent.mcp_servers
      );

      if (!toolNames.includes(params.tool_name)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Agent ${params.agent_name} does not have access to tool: ${params.tool_name}`,
                available_tools: toolNames
              }, null, 2)
            }
          ],
          isError: true
        };
      }

      // Call the tool
      console.log(`[AgentsToolsCallTool] Calling ${params.tool_name} for agent ${params.agent_name}`);

      const result = await this.mcpClientManager.callTool(
        params.tool_name,
        params.arguments
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        isError: false
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: 'Failed to call tool',
              tool: params.tool_name,
              agent: params.agent_name,
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}
