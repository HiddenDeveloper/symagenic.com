/**
 * Centralized Zod validation schemas for all AI Recall MCP tools
 * This creates a virtuous cycle: validation errors are immediately visible to callers,
 * providing clear, actionable feedback that helps both humans and AIs fix issues.
 */

import { z } from 'zod';

/**
 * Schema for get_schema tool
 */
export const GetSchemaParamsSchema = z.object({
  include_statistics: z.boolean()
    .optional()
    .default(true)
    .describe('Include collection statistics (total turns, indexed vectors)'),
}).strict();

/**
 * Schema for semantic_search tool
 */
export const SemanticSearchParamsSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .describe('REQUIRED: Search query text (will be embedded automatically)'),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(10)
    .describe('Maximum number of results to return (1-100, default: 10)'),
  threshold: z.number()
    .min(0.0, 'Threshold must be between 0.0 and 1.0')
    .max(1.0, 'Threshold must be between 0.0 and 1.0')
    .optional()
    .default(0.7)
    .describe('Minimum similarity score (0.0-1.0, default: 0.7)'),
  filters: z.record(z.any())
    .optional()
    .describe('Optional filters: provider, date_time range, role, etc.'),
}).strict();

/**
 * Schema for text_search tool
 */
export const TextSearchParamsSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .describe('REQUIRED: Text query to search for in metadata'),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(10)
    .describe('Maximum number of results (1-100, default: 10)'),
  fields: z.array(z.string())
    .optional()
    .describe('Fields to search (text, conversation_title, provider, etc.)'),
  provider: z.string()
    .optional()
    .describe('Filter by AI provider (chatgpt, claude, OpenAI)'),
  date_from: z.string()
    .optional()
    .describe('Start date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)'),
  date_to: z.string()
    .optional()
    .describe('End date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)'),
}).strict();

/**
 * Schema for system_status tool
 */
export const SystemStatusParamsSchema = z.object({}).strict();

/**
 * Map of tool names to their validation schemas
 */
export const TOOL_SCHEMAS = {
  'get_schema': GetSchemaParamsSchema,
  'semantic_search': SemanticSearchParamsSchema,
  'text_search': TextSearchParamsSchema,
  'system_status': SystemStatusParamsSchema,
} as const;

/**
 * Validate tool parameters and return detailed error messages
 * Returns { success: true, data } or { success: false, error }
 *
 * This creates the "virtuous cycle":
 * 1. AI calls tool with params
 * 2. Validation catches issues immediately
 * 3. Clear, actionable error returned
 * 4. AI fixes params and retries
 * 5. Success!
 */
export function validateToolParams(toolName: string, params: unknown) {
  const schema = TOOL_SCHEMAS[toolName as keyof typeof TOOL_SCHEMAS];

  if (!schema) {
    return {
      success: false as const,
      error: `Unknown tool: ${toolName}. Available tools: ${Object.keys(TOOL_SCHEMAS).join(', ')}`
    };
  }

  const result = schema.safeParse(params);

  if (!result.success) {
    // Format Zod errors into a clear, actionable message
    const errorMessages = result.error.errors.map(err => {
      const path = err.path.length > 0 ? `"${err.path.join('.')}"` : 'parameters';
      return `- ${path}: ${err.message}`;
    }).join('\n');

    return {
      success: false as const,
      error: `Validation failed for tool "${toolName}":\n${errorMessages}\n\nPlease fix these issues and try again.`
    };
  }

  return {
    success: true as const,
    data: result.data
  };
}

export type ToolName = keyof typeof TOOL_SCHEMAS;
