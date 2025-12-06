/**
 * Dynamic Tool Registry - New Implementation
 *
 * This file exports the new dynamic tool registry system.
 * The old hard-coded ToolRegistryManager has been replaced with
 * filesystem-based tool discovery using decorators.
 */

// Import and re-export all components
import * as ToolDecorator from './tool-function-decorator.js';
import * as DynamicRegistry from './dynamic-tool-registry.js';

// Export decorator components
export const toolFunction = ToolDecorator.toolFunction;
export const _TOOL_REGISTRY = ToolDecorator._TOOL_REGISTRY;

// Export types
export type ToolFunction = ToolDecorator.ToolFunction;
export type ToolContext = ToolDecorator.ToolContext;
export type ToolMetadata = ToolDecorator.ToolMetadata;
export type StoredToolEntry = ToolDecorator.StoredToolEntry;

// Export dynamic registry components
export const importToolModules = DynamicRegistry.importToolModules;
export const DynamicToolRegistry = DynamicRegistry.DynamicToolRegistry;
export const ToolRegistryManagerAdapter = DynamicRegistry.ToolRegistryManagerAdapter;
export const initializeToolRegistry = DynamicRegistry.initializeToolRegistry;
export const createDynamicToolRegistry = DynamicRegistry.createDynamicToolRegistry;

// For backwards compatibility, export the adapter as ToolRegistryManager
export const ToolRegistryManager = DynamicRegistry.ToolRegistryManagerAdapter;

/**
 * @deprecated Use the new dynamic tool registry system instead.
 * Import ToolRegistryManagerAdapter directly or use ServiceFactory.initializeTools()
 */
export const LegacyToolRegistryManager = {
  getInstance() {
    console.warn(
      'ToolRegistryManager.getInstance() is deprecated. Use the new dynamic tool registry system.'
    );
    throw new Error(
      'Legacy ToolRegistryManager is no longer supported. Use dynamic tool registry instead.'
    );
  },
};
