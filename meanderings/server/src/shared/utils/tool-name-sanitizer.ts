/**
 * Tool Name Sanitizer
 *
 * Provides provider-agnostic tool name sanitization to ensure compatibility
 * across all LLM providers (Anthropic, Google, OpenAI, Ollama).
 *
 * Problem: Different providers have different naming restrictions:
 * - Google: Claims to accept dashes but rejects certain patterns
 * - OpenAI: Accepts underscores and dashes
 * - Anthropic: Accepts underscores and dashes
 *
 * Solution: Convert all tool names to the safest common format:
 * - Only alphanumeric characters and underscores
 * - Start with letter or underscore
 * - Max 64 characters
 */

export interface ToolNameMapping {
  original: string;
  sanitized: string;
}

/**
 * Sanitize a tool name to be compatible with all providers
 *
 * Rules:
 * - Replace dashes with underscores
 * - Replace dots with underscores
 * - Replace colons with underscores
 * - Remove any other special characters
 * - Ensure starts with letter or underscore
 * - Truncate to 64 characters
 */
export function sanitizeToolName(name: string): string {
  // Replace dashes, dots, colons with underscores
  let sanitized = name.replace(/[-.:]/g, '_');

  // Remove any other special characters (keep only alphanumeric and underscore)
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '');

  // Ensure starts with letter or underscore
  if (sanitized.length > 0 && /^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  // Truncate to 64 characters (provider maximum)
  if (sanitized.length > 64) {
    sanitized = sanitized.substring(0, 64);
  }

  return sanitized;
}

/**
 * Create bidirectional mapping for tool names
 * This allows providers to use sanitized names while maintaining original names internally
 */
export function createToolNameMapping(toolNames: string[]): Map<string, ToolNameMapping> {
  const mapping = new Map<string, ToolNameMapping>();

  for (const original of toolNames) {
    const sanitized = sanitizeToolName(original);
    mapping.set(sanitized, { original, sanitized });

    // Also map original to itself for lookup convenience
    mapping.set(original, { original, sanitized });
  }

  return mapping;
}

/**
 * Sanitize tool definitions for provider compatibility
 * Returns both sanitized tools and mapping for reverse lookup
 */
export function sanitizeTools<T extends { name: string }>(
  tools: T[]
): { sanitizedTools: T[]; nameMapping: Map<string, ToolNameMapping> } {
  const toolNames = tools.map(t => t.name);
  const nameMapping = createToolNameMapping(toolNames);

  const sanitizedTools = tools.map(tool => ({
    ...tool,
    name: sanitizeToolName(tool.name)
  }));

  return { sanitizedTools, nameMapping };
}

/**
 * Get original tool name from sanitized name
 */
export function getOriginalToolName(
  sanitizedName: string,
  mapping: Map<string, ToolNameMapping>
): string {
  const entry = mapping.get(sanitizedName);
  return entry?.original || sanitizedName;
}

/**
 * Get sanitized tool name from original name
 */
export function getSanitizedToolName(
  originalName: string,
  mapping: Map<string, ToolNameMapping>
): string {
  const entry = mapping.get(originalName);
  return entry?.sanitized || sanitizeToolName(originalName);
}
