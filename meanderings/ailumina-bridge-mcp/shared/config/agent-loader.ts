/**
 * Agent Configuration Loader
 *
 * Loads agent configurations from the Ailumina server and caches them.
 * Provides agent metadata for tier 1-2 discovery.
 */

import { AgentConfig, AgentSummary } from '../types.js';

export class AgentConfigLoader {
  private agents: Map<string, AgentConfig> = new Map();
  private lastLoad: Date | null = null;
  private cacheTTL = 600_000; // 10 minutes in milliseconds

  constructor(
    private serverUrl: string,
    private bearerToken?: string
  ) {}

  /**
   * Load agents from server
   */
  async loadAgents(): Promise<Map<string, AgentConfig>> {
    console.log(`[AgentConfigLoader] Loading agents from ${this.serverUrl}/api/agents...`);

    try {
      const response = await fetch(`${this.serverUrl}/api/agents`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.bearerToken ? { 'Authorization': `Bearer ${this.bearerToken}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Server returns { agents: { key: config, ... } }
      const agentsObject = data.agents || {};

      // Convert to Map and normalize
      this.agents.clear();
      for (const [key, config] of Object.entries(agentsObject)) {
        const agentConfig = config as any;
        this.agents.set(key, {
          name: key,
          description: agentConfig.description || `Agent: ${key}`,
          mcp_servers: agentConfig.mcp_servers || [],
          system_prompt: agentConfig.system_prompt || ''
        });
      }

      this.lastLoad = new Date();
      console.log(`[AgentConfigLoader] Loaded ${this.agents.size} agents`);

      return this.agents;
    } catch (error) {
      console.error('[AgentConfigLoader] Failed to load agents:', error);
      // Return cached agents if load fails
      return this.agents;
    }
  }

  /**
   * Get a specific agent by name
   */
  getAgent(name: string): AgentConfig | undefined {
    return this.agents.get(name);
  }

  /**
   * List all agents as summaries
   */
  listAgents(): AgentSummary[] {
    return Array.from(this.agents.entries()).map(([key, config]) => ({
      name: key,
      description: config.description,
      mcp_servers: config.mcp_servers,
      tool_count: 0 // Will be populated by MCPClientManager
    }));
  }

  /**
   * Check if cache is stale
   */
  isCacheStale(): boolean {
    if (!this.lastLoad) return true;
    const age = Date.now() - this.lastLoad.getTime();
    return age > this.cacheTTL;
  }

  /**
   * Reload agents from server
   */
  async reload(): Promise<void> {
    console.log('[AgentConfigLoader] Reloading agents...');
    await this.loadAgents();
  }

  /**
   * Get agents with auto-reload if cache is stale
   */
  async getAgentsWithRefresh(): Promise<Map<string, AgentConfig>> {
    if (this.isCacheStale()) {
      await this.loadAgents();
    }
    return this.agents;
  }
}
