import { v4 as uuidv4 } from 'uuid';
import { AgentConfig, ServiceProvider, ToolRegistry } from '../types/index.js';
import { ServiceFactory } from '../services/service-factory.js';
import { AgentConfigManager } from '../config/agent-config.js';
import { ToolRegistryManagerAdapter } from '../tools/dynamic-tool-registry.js';
import { ToolContext } from '../tools/tool-function-decorator.js';

export interface Agent {
  name: string;
  config: AgentConfig;
  serviceProvider: ServiceProvider;
  sessionId: string;
  toolRegistry?: ToolRegistry;
  toolContext?: ToolContext;
}

export class AgentFactory {
  private static configManager: AgentConfigManager;
  private static toolRegistryManager: ToolRegistryManagerAdapter;

  static initialize(configPath?: string): void {
    this.configManager = AgentConfigManager.getInstance(configPath);
    // Tool registry manager will be initialized separately via ServiceFactory
  }

  static createAgent(agentName: string, sessionId?: string, customConfig?: AgentConfig): Agent {
    // Get agent configuration
    let config: AgentConfig;

    if (customConfig) {
      config = customConfig;
    } else {
      const loadedConfig = this.configManager.getAgentConfig(agentName);
      if (!loadedConfig) {
        throw new Error(`Agent configuration not found: ${agentName}`);
      }
      config = loadedConfig;
    }

    // Generate session ID if not provided
    const finalSessionId = sessionId || uuidv4();

    // Build tool registry from agent's available functions
    const toolRegistry = this.toolRegistryManager.buildToolRegistry(
      config.available_functions || []
    );

    // Create tool context for this agent
    const toolContext: ToolContext = {
      agentName,
      sessionId: finalSessionId,
      workingDirectory: config.custom_settings?.working_directory as string | undefined,
      customSettings: config.custom_settings,
    };

    // Validate required environment variables
    const requiredEnvVars = ServiceFactory.getRequiredEnvVars(config.service_provider);
    const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables for ${config.service_provider}: ${missingVars.join(', ')}`
      );
    }

    // Create service provider
    const serviceProvider = ServiceFactory.createServiceProvider(config, toolRegistry);

    const agent: Agent = {
      name: agentName,
      config,
      serviceProvider,
      sessionId: finalSessionId,
      toolRegistry,
      toolContext,
    };

    console.log(
      `Created agent: ${agentName} (${config.service_provider}/${config.model_name}) with session: ${finalSessionId}`
    );

    return agent;
  }

  static getAvailableAgents(): string[] {
    if (!this.configManager) {
      throw new Error('AgentFactory not initialized. Call initialize() first.');
    }
    return this.configManager.getAgentNames();
  }

  static hasAgent(agentName: string): boolean {
    if (!this.configManager) {
      return false;
    }
    return this.configManager.hasAgent(agentName);
  }

  static getAgentConfig(agentName: string): AgentConfig | null {
    if (!this.configManager) {
      return null;
    }
    return this.configManager.getAgentConfig(agentName);
  }

  static validateAgentType(agentType: string): boolean {
    // Validate that agent type corresponds to a known agent or is a supported type
    const knownTypes = ['crud', 'news', 'collaborator', 'ailumina'];

    if (knownTypes.includes(agentType)) {
      return true;
    }

    // Check if it's a configured agent name
    return this.hasAgent(agentType);
  }

  static mapAgentTypeToName(agentType: string): string {
    // Map common agent types to actual agent names
    const typeMapping: Record<string, string> = {
      crud: 'crm',
      news: 'news',
      collaborator: 'memory',
      ailumina: 'AIlumina',
    };

    return typeMapping[agentType] || agentType;
  }

  static checkEnvironment(): {
    available: boolean;
    missing: string[];
    providers: Record<string, boolean>;
  } {
    const providerStatus = ServiceFactory.checkEnvironmentVariables();
    const missingProviders = Object.entries(providerStatus)
      .filter(([, available]) => !available)
      .map(([provider]) => provider);

    return {
      available: missingProviders.length === 0,
      missing: missingProviders,
      providers: providerStatus,
    };
  }

  static createTestAgent(
    baseAgentName: string,
    testOverrides: Partial<AgentConfig>,
    sessionId?: string
  ): Agent {
    const baseConfig = this.getAgentConfig(baseAgentName);
    if (!baseConfig) {
      throw new Error(`Base agent configuration not found: ${baseAgentName}`);
    }

    const testConfig: AgentConfig = {
      ...baseConfig,
      ...testOverrides,
      description: `${baseConfig.description} (Test Configuration)`,
    };

    return this.createAgent(`${baseAgentName}_test_${Date.now()}`, sessionId, testConfig);
  }
}
