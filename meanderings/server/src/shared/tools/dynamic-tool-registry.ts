/**
 * Dynamic Tool Registry
 * TypeScript equivalent of Python's tool_registry.py
 *
 * This module provides dynamic tool discovery by scanning filesystem directories
 * and importing tool modules that use the @toolFunction decorator.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { _TOOL_REGISTRY, ToolFunction, ToolContext } from './tool-function-decorator.js';
import { ToolDefinition, ToolRegistry } from '../types/index.js';
import { MCPClientManager } from './mcp-manager.js';
import winston from 'winston';

// Directories containing the tool modules
const FUNCTION_DIRECTORY = 'functions';
const AGENT_DIRECTORY = 'agents';

/**
 * Get the current directory path (equivalent to __dirname in CommonJS)
 */
function getCurrentDirname(): string {
  // In ES modules, we need to construct __dirname equivalent
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }

  // For ES modules
  const currentFileUrl = import.meta.url;
  if (currentFileUrl) {
    return path.dirname(fileURLToPath(currentFileUrl));
  }

  // Fallback to current working directory
  return process.cwd();
}

/**
 * Dynamically import TypeScript/JavaScript modules from both functions and agents directories.
 * This is the TypeScript equivalent of Python's import_tool_modules() function.
 */
export async function importToolModules(logger: winston.Logger): Promise<void> {
  const currentDir = getCurrentDirname();
  const functionsDir = path.join(currentDir, FUNCTION_DIRECTORY);
  const agentsDir = path.join(currentDir, AGENT_DIRECTORY);

  // Import function modules
  try {
    const functionFiles = await fs.readdir(functionsDir);

    for (const filename of functionFiles) {
      if ((filename.endsWith('.js') || filename.endsWith('.ts')) && !filename.startsWith('__')) {
        const modulePath = path.join(functionsDir, filename);
        // Cache busting: append timestamp to force fresh import (Bun properly GCs old versions)
        const moduleUrl = `file://${modulePath}?t=${Date.now()}`;

        try {
          logger.info(`Loading tool module: ${filename}`);
          await import(moduleUrl);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to import tool module ${filename}: ${errorMsg}`);
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to read functions directory ${functionsDir}: ${errorMsg}`);
  }

  // Import agent modules
  try {
    const agentFiles = await fs.readdir(agentsDir);

    for (const filename of agentFiles) {
      if ((filename.endsWith('.js') || filename.endsWith('.ts')) && !filename.startsWith('__')) {
        const modulePath = path.join(agentsDir, filename);
        // Cache busting: append timestamp to force fresh import (Bun properly GCs old versions)
        const moduleUrl = `file://${modulePath}?t=${Date.now()}`;

        try {
          logger.info(`Loading agent module: ${filename}`);
          await import(moduleUrl);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`Failed to import agent module ${filename}: ${errorMsg}`);
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to read agents directory ${agentsDir}: ${errorMsg}`);
  }
}

// Removed unused createSubToolRegistry function

/**
 * Dynamic Tool Registry class for managing both functions and agents.
 * TypeScript equivalent of Python's ToolRegistry class.
 */
export class DynamicToolRegistry {
  private logger: winston.Logger;
  private definitions: ToolDefinition[];
  private functionRegistry: Record<string, ToolFunction>;
  private functionDefinitions: ToolDefinition[];

  constructor(
    logger: winston.Logger,
    definitions: ToolDefinition[],
    functionsDict: Record<string, ToolFunction>
  ) {
    this.logger = logger;
    this.definitions = definitions;
    this.functionRegistry = functionsDict;
    this.functionDefinitions = definitions;
  }

  /**
   * Call a registered function or agent by name.
   * TypeScript equivalent of Python's call_function method.
   *
   * @param functionName - Name of the function to call
   * @param kwargs - Arguments to pass to the function
   * @returns Result of the function call
   * @throws Error if function_name is not found in registry
   */
  async callFunction(
    functionName: string,
    parameters: Record<string, unknown> = {},
    context?: ToolContext
  ): Promise<unknown> {
    const func = this.functionRegistry[functionName];
    if (func) {
      return await func(parameters, context);
    }
    throw new Error(`Invalid function name: ${functionName}`);
  }

  /**
   * Get all function definitions
   */
  getDefinitions(): ToolDefinition[] {
    return this.definitions;
  }

  /**
   * Get function registry
   */
  getFunctionRegistry(): Record<string, ToolFunction> {
    return this.functionRegistry;
  }

  /**
   * Check if a function exists in the registry
   */
  hasFunction(functionName: string): boolean {
    return functionName in this.functionRegistry;
  }

  /**
   * Get available function names
   */
  getAvailableFunctions(): string[] {
    return Object.keys(this.functionRegistry);
  }
}

/**
 * Create a DynamicToolRegistry instance with all registered tools.
 * This function should be called after importToolModules() to get the populated registry.
 */
export function createDynamicToolRegistry(logger: winston.Logger): DynamicToolRegistry {
  // Convert the global registry to the format expected by DynamicToolRegistry
  const definitions: ToolDefinition[] = [];
  const functionsDict: Record<string, ToolFunction> = {};

  for (const [name, tool] of _TOOL_REGISTRY.entries()) {
    // Type assertion to handle both local tools and MCP tools with inputSchema
    const toolDef = tool.definition as ToolDefinition;
    
    definitions.push({
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.parameters,
      // Preserve inputSchema for MCP tools with complete OpenAPI schemas
      inputSchema: toolDef.inputSchema,
      enabled: toolDef.enabled,
    });

    functionsDict[name] = tool.function;
  }

  return new DynamicToolRegistry(logger, definitions, functionsDict);
}

/**
 * Initialize the tool registry by importing all tool modules and MCP tools, then creating the registry instance.
 * This should be called once at application startup.
 */
export async function initializeToolRegistry(
  logger: winston.Logger,
  mcpClientManager?: MCPClientManager
): Promise<DynamicToolRegistry> {
  logger.info('Initializing dynamic tool registry...');

  // Import all tool modules - this populates _TOOL_REGISTRY
  await importToolModules(logger);

  logger.info(`Loaded ${_TOOL_REGISTRY.size} tools from filesystem`);

  // Add MCP tools if manager is provided
  if (mcpClientManager) {
    addMCPToolsToRegistry(logger, mcpClientManager);
  }

  // Create and return the registry instance
  return createDynamicToolRegistry(logger);
}

/**
 * Add MCP tools to the global tool registry
 */
function addMCPToolsToRegistry(logger: winston.Logger, mcpClientManager: MCPClientManager): void {
  logger.info('🔧 Adding MCP tools to dynamic registry...');

  const serverTools = mcpClientManager.getServerTools();
  let totalMcpTools = 0;

  for (const [serverName, tools] of Object.entries(serverTools)) {
    logger.info(`  📡 Processing ${Object.keys(tools).length} tools from ${serverName}...`);

    for (const [toolName, toolData] of Object.entries(tools)) {
      // MCP tools are already in the correct format from MCPClientManager
      // Type assertion since we know the structure from MCPClientManager
      const typedToolData = toolData as { definition: ToolDefinition; function: ToolFunction };

      // Just add them to the global registry
      _TOOL_REGISTRY.set(toolName, {
        definition: typedToolData.definition,
        function: typedToolData.function,
      });

      logger.info(`    ➕ Registered MCP tool: ${toolName}`);
      totalMcpTools++;
    }
  }

  logger.info(`✅ Added ${totalMcpTools} MCP tools to dynamic registry`);
  logger.info(`📊 Total tools in registry: ${_TOOL_REGISTRY.size}`);
}

// For backwards compatibility with existing code
export interface ToolRegistryManager {
  executeTool(
    name: string,
    parameters: Record<string, unknown>,
    context?: ToolContext
  ): Promise<unknown>;
  buildToolRegistry(availableFunctions?: string[]): ToolRegistry;
  getAvailableTools(): string[];
  hasEnabledTool(name: string): boolean;
}

/**
 * Backwards compatibility adapter that implements the old ToolRegistryManager interface
 * using the new dynamic registry system.
 */
export class ToolRegistryManagerAdapter implements ToolRegistryManager {
  private dynamicRegistry: DynamicToolRegistry;
  private logger: winston.Logger;

  constructor(dynamicRegistry: DynamicToolRegistry, logger: winston.Logger) {
    this.dynamicRegistry = dynamicRegistry;
    this.logger = logger;
  }

  async executeTool(
    name: string,
    parameters: Record<string, unknown>,
    context?: ToolContext
  ): Promise<unknown> {
    const tool = _TOOL_REGISTRY.get(name);
    if (!tool) {
      return `Error: Tool '${name}' not found`;
    }
    if (!tool.definition.enabled) {
      return `Error: Tool '${name}' is disabled`;
    }

    try {
      return await tool.function(parameters, context);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error: Tool '${name}' execution failed: ${errorMessage}`;
    }
  }

  buildToolRegistry(availableFunctions: string[] = []): ToolRegistry {
    const registry: ToolRegistry = {};

    // CRITICAL FIX: If availableFunctions is empty, agent should get NO tools, not all tools
    const functionsToInclude = availableFunctions;

    this.logger.info(`🔧 Building tool registry with ${functionsToInclude.length} functions...`);

    // If no functions specified, return empty registry
    if (functionsToInclude.length === 0) {
      this.logger.info(
        '📊 Agent has no available_functions specified - returning empty tool registry'
      );
      return registry;
    }

    for (const functionName of functionsToInclude) {
      const tool = _TOOL_REGISTRY.get(functionName);
      if (tool && tool.definition.enabled) {
        registry[functionName] = {
          name: tool.definition.name,
          description: tool.definition.description,
          parameters: tool.definition.parameters,
          enabled: tool.definition.enabled,
        };
        this.logger.info(`  ✅ Added tool: ${functionName}`);
      } else if (tool && !tool.definition.enabled) {
        this.logger.warn(`  ⚠️ Tool '${functionName}' found but disabled`);
      } else {
        this.logger.warn(`  ❌ Tool '${functionName}' not found in global registry`);
      }
    }

    this.logger.info(`📊 Built tool registry with ${Object.keys(registry).length} enabled tools`);
    return registry;
  }

  getAvailableTools(): string[] {
    return Array.from(_TOOL_REGISTRY.keys()).filter((name) => {
      const tool = _TOOL_REGISTRY.get(name);
      return tool && tool.definition.enabled;
    });
  }

  hasEnabledTool(name: string): boolean {
    const tool = _TOOL_REGISTRY.get(name);
    return tool !== undefined && tool.definition.enabled;
  }
}
