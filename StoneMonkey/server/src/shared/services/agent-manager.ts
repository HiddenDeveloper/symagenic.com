/**
 * Agent Manager Service
 *
 * Handles safe CRUD operations on agents.json for autonomous AI agent management.
 * Enables AI to modify its own configuration and capabilities.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import winston from 'winston';
import lockfile from 'proper-lockfile';
import { AgentConfig } from '../types/index.js';

export class AgentManager {
  private logger: winston.Logger;
  private agentsFilePath: string;
  private backupDir: string;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.agentsFilePath = path.join(process.cwd(), 'agents.json');
    this.backupDir = path.join(process.cwd(), 'backups/agents');
  }

  /**
   * Load agents.json
   */
  private async loadAgents(): Promise<Record<string, AgentConfig>> {
    const content = await fs.readFile(this.agentsFilePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save agents.json with file locking and backup
   */
  private async saveAgents(agents: Record<string, AgentConfig>): Promise<void> {
    // Acquire lock on agents.json
    let release;
    try {
      release = await lockfile.lock(this.agentsFilePath, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000,
        },
      });
    } catch (error) {
      this.logger.error('Failed to acquire lock on agents.json:', error);
      throw new Error('Could not acquire file lock - another process may be writing');
    }

    try {
      // Create backup directory
      await fs.mkdir(this.backupDir, { recursive: true });

      // Backup current agents.json
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = path.join(this.backupDir, `agents.${timestamp}.json`);

      try {
        await fs.copyFile(this.agentsFilePath, backupPath);
        this.logger.info(`📦 Created backup: ${path.basename(backupPath)}`);
      } catch (error) {
        this.logger.warn('Failed to create backup:', error);
      }

      // Direct write with lock held (no rename needed - lock protects us)
      await fs.writeFile(this.agentsFilePath, JSON.stringify(agents, null, 2) + '\n', 'utf-8');

      this.logger.info('✅ Agents configuration saved');
    } finally {
      // Always release lock
      await release();
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(agentKey: string, config: AgentConfig): Promise<{
    success: boolean;
    message: string;
    agent?: AgentConfig;
  }> {
    try {
      const agents = await this.loadAgents();

      if (agents[agentKey]) {
        return {
          success: false,
          message: `Agent ${agentKey} already exists`,
        };
      }

      // Validate required fields
      if (!config.service_provider || !config.model_name || !config.description) {
        return {
          success: false,
          message: 'Missing required fields: service_provider, model_name, description',
        };
      }

      // Set defaults
      const newAgent: AgentConfig = {
        ...config,
        available_functions: config.available_functions || [],
      };

      agents[agentKey] = newAgent;
      await this.saveAgents(agents);

      this.logger.info(`🎉 Created new agent: ${agentKey}`);

      return {
        success: true,
        message: `Agent ${agentKey} created successfully`,
        agent: newAgent,
      };

    } catch (error: unknown) {
      this.logger.error('Create agent failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Create agent failed',
      };
    }
  }

  /**
   * Get all agents
   */
  async getAgents(): Promise<Record<string, AgentConfig>> {
    return await this.loadAgents();
  }

  /**
   * Get a specific agent
   */
  async getAgent(agentKey: string): Promise<{
    success: boolean;
    agent?: AgentConfig;
    message?: string;
  }> {
    try {
      const agents = await this.loadAgents();

      if (!agents[agentKey]) {
        return {
          success: false,
          message: `Agent ${agentKey} not found`,
        };
      }

      return {
        success: true,
        agent: agents[agentKey],
      };

    } catch (error: unknown) {
      this.logger.error('Get agent failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Get agent failed',
      };
    }
  }

  /**
   * Update an agent
   */
  async updateAgent(agentKey: string, updates: Partial<AgentConfig>): Promise<{
    success: boolean;
    message: string;
    agent?: AgentConfig;
  }> {
    try {
      const agents = await this.loadAgents();

      if (!agents[agentKey]) {
        return {
          success: false,
          message: `Agent ${agentKey} not found`,
        };
      }

      // Merge updates
      const updatedAgent = {
        ...agents[agentKey],
        ...updates,
      };

      agents[agentKey] = updatedAgent;
      await this.saveAgents(agents);

      this.logger.info(`🔄 Updated agent: ${agentKey}`);

      return {
        success: true,
        message: `Agent ${agentKey} updated successfully`,
        agent: updatedAgent,
      };

    } catch (error: unknown) {
      this.logger.error('Update agent failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Update agent failed',
      };
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentKey: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const agents = await this.loadAgents();

      if (!agents[agentKey]) {
        return {
          success: false,
          message: `Agent ${agentKey} not found`,
        };
      }

      delete agents[agentKey];
      await this.saveAgents(agents);

      this.logger.info(`🗑️  Deleted agent: ${agentKey}`);

      return {
        success: true,
        message: `Agent ${agentKey} deleted successfully`,
      };

    } catch (error: unknown) {
      this.logger.error('Delete agent failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Delete agent failed',
      };
    }
  }

  /**
   * Add function to agent's available_functions
   */
  async addFunctionToAgent(agentKey: string, functionName: string): Promise<{
    success: boolean;
    message: string;
    available_functions?: string[];
  }> {
    try {
      const agents = await this.loadAgents();

      if (!agents[agentKey]) {
        return {
          success: false,
          message: `Agent ${agentKey} not found`,
        };
      }

      const agent = agents[agentKey];
      const availableFunctions = agent.available_functions || [];

      if (availableFunctions.includes(functionName)) {
        return {
          success: true,
          message: `Function ${functionName} already available to ${agentKey}`,
          available_functions: availableFunctions,
        };
      }

      availableFunctions.push(functionName);
      agent.available_functions = availableFunctions;

      agents[agentKey] = agent;
      await this.saveAgents(agents);

      this.logger.info(`➕ Added function ${functionName} to agent ${agentKey}`);

      return {
        success: true,
        message: `Function ${functionName} added to ${agentKey}`,
        available_functions: availableFunctions,
      };

    } catch (error: unknown) {
      this.logger.error('Add function to agent failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Add function failed',
      };
    }
  }

  /**
   * Remove function from agent's available_functions
   */
  async removeFunctionFromAgent(agentKey: string, functionName: string): Promise<{
    success: boolean;
    message: string;
    available_functions?: string[];
  }> {
    try {
      const agents = await this.loadAgents();

      if (!agents[agentKey]) {
        return {
          success: false,
          message: `Agent ${agentKey} not found`,
        };
      }

      const agent = agents[agentKey];
      const availableFunctions = agent.available_functions || [];

      if (!availableFunctions.includes(functionName)) {
        return {
          success: false,
          message: `Function ${functionName} not found in ${agentKey}`,
        };
      }

      agent.available_functions = availableFunctions.filter(f => f !== functionName);

      agents[agentKey] = agent;
      await this.saveAgents(agents);

      this.logger.info(`➖ Removed function ${functionName} from agent ${agentKey}`);

      return {
        success: true,
        message: `Function ${functionName} removed from ${agentKey}`,
        available_functions: agent.available_functions,
      };

    } catch (error: unknown) {
      this.logger.error('Remove function from agent failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Remove function failed',
      };
    }
  }
}
