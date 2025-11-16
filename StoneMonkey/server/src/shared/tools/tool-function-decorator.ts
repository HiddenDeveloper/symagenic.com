/**
 * This module defines a decorator for registering tool functions with their metadata.
 * TypeScript equivalent of Python's tool_function_decorator.py
 */

/**
 * Tool function interface - all tools must implement this
 */
export type ToolFunction = (parameters: unknown, context?: ToolContext) => unknown;

/**
 * Context passed to tool functions
 */
export interface ToolContext {
  agentName: string;
  sessionId?: string;
  workingDirectory?: string;
  customSettings?: Record<string, unknown>;
}

/**
 * Tool metadata for registration
 */
export interface ToolMetadata {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  enabled?: boolean;
}

/**
 * Storage interface for registered tools
 */
export interface StoredToolEntry {
  definition: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    enabled: boolean;
  };
  function: ToolFunction;
}

/**
 * Global tool registry storage - equivalent to Python's _TOOL_REGISTRY
 */
export const _TOOL_REGISTRY = new Map<string, StoredToolEntry>();

/**
 * Decorator for registering a tool function with its metadata.
 * TypeScript equivalent of Python's @tool_function decorator.
 *
 * @param name - The name of the tool function
 * @param description - The description of the tool function
 * @param parameters - The parameters of the tool function (OpenAPI schema)
 * @param enabled - Whether the tool function is enabled (default: true)
 *
 * @returns Function decorator that registers the tool
 */
export function toolFunction(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  enabled = true
) {
  return function <T extends ToolFunction>(target: T): T {
    // Check if tool function with this name already exists
    if (_TOOL_REGISTRY.has(name)) {
      throw new Error(`Tool function with name '${name}' already exists`);
    }

    // Register the tool in the global registry
    _TOOL_REGISTRY.set(name, {
      definition: {
        name,
        description,
        parameters,
        enabled,
      },
      function: target, // Store the function reference directly
    });

    return target;
  };
}

// Removed unused internal utility functions per CLAUDE.md guidelines
