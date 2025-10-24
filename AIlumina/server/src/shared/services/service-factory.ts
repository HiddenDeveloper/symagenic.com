import { AgentConfig, ServiceProvider, ToolRegistry } from '../types/index.js';
import { SERVICE_PROVIDERS } from '../constants/message-constants.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GoogleProvider } from './google-provider.js';
import { GroqProvider } from './groq-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { LMStudioProvider } from './lmstudio-provider.js';
import {
  initializeToolRegistry,
  ToolRegistryManagerAdapter,
} from '../tools/dynamic-tool-registry.js';
import { MCPClientManager } from '../tools/mcp-manager.js';
import winston from 'winston';

export class ServiceFactory {
  private static toolRegistryAdapter: ToolRegistryManagerAdapter | null = null;
  private static mcpClientManager: MCPClientManager | null = null;
  private static logger: winston.Logger | null = null;

  /**
   * Initialize the dynamic tool registry system with optional MCP integration
   * This should be called once at application startup
   */
  static async initializeTools(
    logger: winston.Logger,
    mcpClientManager?: MCPClientManager
  ): Promise<void> {
    this.logger = logger;
    logger.info('Initializing dynamic tool registry...');

    // Store the MCP client manager for later use
    this.mcpClientManager = mcpClientManager || null;

    const dynamicRegistry = await initializeToolRegistry(logger, mcpClientManager);
    this.toolRegistryAdapter = new ToolRegistryManagerAdapter(dynamicRegistry, logger);
    logger.info('Dynamic tool registry initialized successfully');
  }

  /**
   * Get the MCP client manager instance
   */
  static getMCPClientManager(): MCPClientManager | null {
    return this.mcpClientManager;
  }

  static createServiceProvider(
    agentConfig: AgentConfig,
    toolRegistry?: ToolRegistry
  ): ServiceProvider {
    // Ensure tools are initialized
    if (!this.toolRegistryAdapter) {
      this.logger?.warn('Tool registry not initialized. Creating provider without dynamic tools.');
    }

    // Build tool registry with properly filtered MCP tools
    let agentToolRegistry = toolRegistry;
    if (!agentToolRegistry && this.toolRegistryAdapter) {
      // Get the list of available functions for this agent
      const availableFunctions = [...(agentConfig.available_functions || [])];

      // If agent has MCP servers configured, add ALL tools from those servers
      if (agentConfig.mcp_servers && agentConfig.mcp_servers.length > 0 && this.mcpClientManager) {
        const localFunctionCount = (agentConfig.available_functions || []).length;
        let mcpToolCount = 0;

        this.logger?.info(
          `🔧 Adding MCP tools for agent ${agentConfig.agent_name} from ${agentConfig.mcp_servers.length} MCP servers: ${agentConfig.mcp_servers.join(', ')}`
        );

        // Get all MCP server tools
        const allMcpTools = this.mcpClientManager.getServerTools();

        // Add ALL tools from specified MCP servers (not filtered by available_functions)
        for (const serverName of agentConfig.mcp_servers) {
          if (allMcpTools[serverName]) {
            const serverTools = allMcpTools[serverName];
            const serverToolCount = Object.keys(serverTools).length;
            this.logger?.debug(`  📡 Server ${serverName}: adding ${serverToolCount} tools`);

            // Add ALL tools from this MCP server
            for (const toolName of Object.keys(serverTools)) {
              availableFunctions.push(toolName);
              mcpToolCount++;
              this.logger?.debug(`    ✅ Added MCP tool: ${toolName}`);
            }
          } else {
            this.logger?.warn(`  ⚠️ MCP server '${serverName}' not found in loaded servers`);
          }
        }

        this.logger?.info(
          `  📊 Agent ${agentConfig.agent_name}: ${localFunctionCount} local functions + ${mcpToolCount} MCP functions from ${agentConfig.mcp_servers.length} servers`
        );
      }

      // Build the tool registry with filtered available functions (no modification needed - availableFunctions already contains the right tools)
      agentToolRegistry = this.toolRegistryAdapter.buildToolRegistry(availableFunctions);
      this.logger?.info(
        `📊 Agent ${agentConfig.agent_name}: Built tool registry with ${Object.keys(agentToolRegistry).length} total tools`
      );

      // Validation: Ensure agent only gets the tools specified in its configuration
      const validation = this.validateAgentToolConfiguration(agentConfig);
      if (!validation.isValid) {
        this.logger?.warn(`⚠️ Agent ${agentConfig.agent_name} validation failed:`);
        this.logger?.warn(`  Missing local tools: ${validation.missingLocalTools.join(', ')}`);
      } else {
        this.logger?.debug(`✅ Agent ${agentConfig.agent_name} tool configuration is valid`);
        this.logger?.debug(`  Local tools found: ${validation.localToolsFound.length}`);
        this.logger?.debug(`  MCP tools from servers: ${validation.mcpToolsFromServers.length}`);
      }
    }

    let provider: ServiceProvider;
    console.error(
      `ServiceFactory: Creating provider for ${agentConfig.agent_name} with service_provider: ${agentConfig.service_provider}`
    );

    switch (agentConfig.service_provider) {
      case SERVICE_PROVIDERS.OPENAI:
        console.log('ServiceFactory: Creating OpenAIProvider');
        provider = new OpenAIProvider(agentConfig, agentToolRegistry);
        break;

      case SERVICE_PROVIDERS.ANTHROPIC:
        console.log('ServiceFactory: Creating AnthropicProvider');
        provider = new AnthropicProvider(agentConfig, agentToolRegistry);
        break;

      case SERVICE_PROVIDERS.GOOGLE:
        console.log('ServiceFactory: Creating GoogleProvider');
        provider = new GoogleProvider(agentConfig, agentToolRegistry);
        break;

      case SERVICE_PROVIDERS.GROQ:
        provider = new GroqProvider(agentConfig, agentToolRegistry);
        break;

      case SERVICE_PROVIDERS.OLLAMA:
        provider = new OllamaProvider(agentConfig, agentToolRegistry);
        break;

      case SERVICE_PROVIDERS.LMSTUDIO:
        provider = new LMStudioProvider(agentConfig, agentToolRegistry);
        break;

      default:
        throw new Error(`Unsupported service provider: ${String(agentConfig.service_provider)}`);
    }

    // Set the dynamic tool registry adapter if available
    if (this.toolRegistryAdapter && provider.setToolRegistryAdapter) {
      provider.setToolRegistryAdapter(this.toolRegistryAdapter);
    }

    return provider;
  }

  static getSupportedProviders(): string[] {
    return [
      SERVICE_PROVIDERS.OPENAI,
      SERVICE_PROVIDERS.ANTHROPIC,
      SERVICE_PROVIDERS.GOOGLE,
      SERVICE_PROVIDERS.GROQ,
      SERVICE_PROVIDERS.OLLAMA,
      SERVICE_PROVIDERS.LMSTUDIO,
    ];
  }

  static validateProviderConfig(agentConfig: AgentConfig): boolean {
    if (!agentConfig.service_provider) {
      return false;
    }

    const supportedProviders = this.getSupportedProviders();
    return supportedProviders.includes(agentConfig.service_provider);
  }

  static getRequiredEnvVars(provider: string): string[] {
    switch (provider) {
      case SERVICE_PROVIDERS.OPENAI:
        return ['OPENAI_API_KEY'];

      case SERVICE_PROVIDERS.ANTHROPIC:
        return ['ANTHROPIC_API_KEY'];

      case SERVICE_PROVIDERS.GOOGLE:
        return ['GOOGLE_API_KEY'];

      case SERVICE_PROVIDERS.GROQ:
        return ['GROQ_API_KEY'];

      case SERVICE_PROVIDERS.OLLAMA:
      case SERVICE_PROVIDERS.LMSTUDIO:
        return []; // These typically run locally without API keys

      default:
        return [];
    }
  }

  static checkEnvironmentVariables(): Record<string, boolean> {
    const providers = this.getSupportedProviders();
    const envCheck: Record<string, boolean> = {};

    for (const provider of providers) {
      const requiredVars = this.getRequiredEnvVars(provider);
      envCheck[provider] = requiredVars.every((envVar) => !!process.env[envVar]);
    }

    return envCheck;
  }

  /**
   * Validate that an agent's tool configuration is correct
   * Returns validation results for debugging and testing
   */
  static validateAgentToolConfiguration(agentConfig: AgentConfig): {
    isValid: boolean;
    availableFunctions: string[];
    mcpServers: string[];
    mcpToolsFromServers: string[];
    localToolsFound: string[];
    missingLocalTools: string[];
    totalExpectedTools: number;
    totalActualTools: number;
  } {
    const availableFunctions = agentConfig.available_functions || [];
    const mcpServers = agentConfig.mcp_servers || [];
    const mcpToolsFromServers: string[] = [];
    const localToolsFound: string[] = [];
    const missingLocalTools: string[] = [];

    // Check if tool registry is initialized
    if (!this.toolRegistryAdapter) {
      return {
        isValid: false,
        availableFunctions,
        mcpServers,
        mcpToolsFromServers,
        localToolsFound,
        missingLocalTools: availableFunctions,
        totalExpectedTools: availableFunctions.length,
        totalActualTools: 0,
      };
    }

    // Check local tools from available_functions
    const allAvailableTools = this.toolRegistryAdapter.getAvailableTools();
    for (const toolName of availableFunctions) {
      if (allAvailableTools.includes(toolName)) {
        localToolsFound.push(toolName);
      } else {
        missingLocalTools.push(toolName);
      }
    }

    // Get ALL MCP tools from specified servers
    if (this.mcpClientManager && mcpServers.length > 0) {
      const allMcpTools = this.mcpClientManager.getServerTools();
      for (const serverName of mcpServers) {
        if (allMcpTools[serverName]) {
          for (const toolName of Object.keys(allMcpTools[serverName])) {
            mcpToolsFromServers.push(toolName);
          }
        }
      }
    }

    const totalActualTools = localToolsFound.length + mcpToolsFromServers.length;
    const totalExpectedTools = availableFunctions.length + mcpToolsFromServers.length;
    const isValid = missingLocalTools.length === 0;

    return {
      isValid,
      availableFunctions,
      mcpServers,
      mcpToolsFromServers,
      localToolsFound,
      missingLocalTools,
      totalExpectedTools,
      totalActualTools,
    };
  }
}
