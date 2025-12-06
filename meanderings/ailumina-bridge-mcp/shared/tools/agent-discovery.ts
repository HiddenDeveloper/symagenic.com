/**
 * Agent Discovery Tools (Tier 1-2)
 *
 * Provides progressive disclosure of agent capabilities:
 * - Tier 1: List all available agents (agents/list)
 * - Tier 2: Get detailed agent information (agents/get)
 */

import {
  AiluminaToolResponse,
  AgentsListParams,
  AgentsGetParams,
  AgentListResponse,
  AgentDetails
} from '../types.js';
import { AgentConfigLoader } from '../config/agent-loader.js';
import { MCPClientManager } from '../mcp/client-manager.js';

/**
 * Tier 1: List all available agents
 *
 * Returns high-level overview of all agents in the system.
 * This is the entry point for discovering what agents exist.
 */
export class AgentsListTool {
  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {}

  async execute(params: AgentsListParams): Promise<AiluminaToolResponse> {
    try {
      // Refresh agents if cache is stale
      await this.agentLoader.getAgentsWithRefresh();

      // Get agent summaries
      let summaries = this.agentLoader.listAgents();

      // Filter by MCP server if specified
      if (params.mcp_server) {
        summaries = summaries.filter(s =>
          s.mcp_servers.includes(params.mcp_server!)
        );
      }

      // Populate tool counts from MCP Client Manager
      let agentsWithToolCounts = summaries.map(summary => ({
        ...summary,
        tool_count: this.mcpClientManager.getToolsForAgent(
          summary.name,
          summary.mcp_servers
        ).length
      }));

      // Apply limit if specified
      if (params.limit && params.limit > 0) {
        // Sort by tool count descending before limiting
        agentsWithToolCounts.sort((a, b) => b.tool_count - a.tool_count);
        agentsWithToolCounts = agentsWithToolCounts.slice(0, params.limit);
      }

      const response: AgentListResponse = {
        agents: agentsWithToolCounts
      };

      // Count agents with tools
      const agentsWithTools = agentsWithToolCounts.filter(a => a.tool_count > 0).length;

      const filterInfo = params.mcp_server
        ? `\nFiltered by MCP server: **${params.mcp_server}**`
        : '';
      const limitInfo = params.limit
        ? `\nShowing top ${params.limit} agents (sorted by tool count)`
        : '';

      const overview = `📋 **Tier 1: Agent Discovery**${filterInfo}${limitInfo}

Found ${agentsWithToolCounts.length} agents${params.mcp_server ? ` using "${params.mcp_server}" server` : ' in the system'}:
- ${agentsWithTools} agents have MCP server access and tools
- ${agentsWithToolCounts.length - agentsWithTools} agents have no tools configured

**Top agents by tool count:**
${agentsWithToolCounts
  .filter(a => a.tool_count > 0)
  .sort((a, b) => b.tool_count - a.tool_count)
  .slice(0, 5)
  .map(a => `  • ${a.name}: ${a.tool_count} tools`)
  .join('\n')}

**Next step:** Use agents_get with an agent name to see detailed configuration and tool names.

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
              error: 'Failed to list agents',
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
 * Tier 2: Get detailed agent information
 *
 * Returns comprehensive details about a specific agent including:
 * - Description and system prompt
 * - MCP servers it has access to
 * - List of available tools (names only, not schemas)
 * - Tool count
 */
export class AgentsGetTool {
  constructor(
    private agentLoader: AgentConfigLoader,
    private mcpClientManager: MCPClientManager
  ) {}

  async execute(params: AgentsGetParams): Promise<AiluminaToolResponse> {
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

      // Get tool names (not full schemas - that's Tier 3)
      const toolNames = this.mcpClientManager.getToolNamesForAgent(
        agent.name,
        agent.mcp_servers
      );

      const response: AgentDetails = {
        name: agent.name,
        description: agent.description,
        mcp_servers: agent.mcp_servers,
        system_prompt: agent.system_prompt,
        tools: toolNames,
        tool_count: toolNames.length
      };

      const overview = `🔍 **Tier 2: Agent Details - ${agent.name}**

${agent.description}

**MCP Server Access:** ${agent.mcp_servers.length > 0 ? agent.mcp_servers.join(', ') : 'None'}
**Total Tools:** ${toolNames.length}

${toolNames.length > 0 ? `**Available Tools:**
${toolNames.slice(0, 10).map(t => `  • ${t}`).join('\n')}${toolNames.length > 10 ? `\n  ... and ${toolNames.length - 10} more` : ''}` : 'No tools available for this agent.'}

**Next step:** ${toolNames.length > 0 ? `Use agents_tools_list with agent_name="${agent.name}" to see full tool schemas and parameter details.` : 'This agent has no tools configured.'}

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
              error: 'Failed to get agent details',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}
