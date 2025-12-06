/**
 * Centralized Zod validation schemas for all Memory tools
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
    .describe('Include node/relationship counts in schema response')
}).strict();

/**
 * Schema for semantic_search tool
 */
export const SemanticSearchParamsSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .describe('The search query to find semantically similar content'),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(10)
    .optional()
    .describe('Maximum number of results to return (1-100)'),
  threshold: z.number()
    .min(0, 'Threshold must be between 0 and 1')
    .max(1, 'Threshold must be between 0 and 1')
    .default(0.7)
    .optional()
    .describe('Similarity threshold (0.0-1.0). Higher = more similar'),
  node_types: z.array(z.string())
    .optional()
    .describe('Filter results to specific node types (e.g., ["Insight", "Pattern"])')
}).strict();

/**
 * Schema for text_search tool
 */
export const TextSearchParamsSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .describe('The text to search for (substring matching)'),
  node_types: z.array(z.string())
    .optional()
    .describe('Filter to specific node types'),
  properties: z.array(z.string())
    .optional()
    .describe('Search only in specific properties'),
  fuzzy: z.boolean()
    .optional()
    .describe('Enable fuzzy matching'),
  limit: z.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(10)
    .optional()
    .describe('Maximum number of results')
}).strict();

/**
 * Schema for execute_cypher tool
 * IMPORTANT: Mode is mandatory to enforce explicit intent
 */
export const ExecuteCypherParamsSchema = z.object({
  query: z.string()
    .min(1, 'Cypher query cannot be empty')
    .describe('The Cypher query to execute'),
  mode: z.enum(['READ', 'WRITE'], {
    errorMap: () => ({
      message: 'Mode must be either "READ" or "WRITE". This parameter is REQUIRED to ensure explicit intent. Use READ for queries (MATCH, RETURN). Use WRITE for modifications (CREATE, MERGE, SET, DELETE, REMOVE).'
    })
  }).describe('REQUIRED: Execution mode - READ for queries, WRITE for modifications'),
  parameters: z.record(z.any())
    .optional()
    .describe('Parameters for parameterized queries (e.g., {name: "value"})'),
  client_schema_epoch: z.number()
    .int('Schema epoch must be an integer')
    .min(1, 'Schema epoch must be positive')
    .optional()
    .describe('Schema epoch from get_schema; include for WRITE requests to detect concurrent schema changes')
}).strict();

/**
 * Schema for system_status tool
 */
export const SystemStatusParamsSchema = z.object({}).strict();

/**
 * Schema for load_current_focus tool
 */
export const LoadCurrentFocusParamsSchema = z.object({}).strict();

/**
 * Map of tool names to their validation schemas
 */
export const TOOL_SCHEMAS = {
  get_schema: GetSchemaParamsSchema,
  semantic_search: SemanticSearchParamsSchema,
  text_search: TextSearchParamsSchema,
  execute_cypher: ExecuteCypherParamsSchema,
  system_status: SystemStatusParamsSchema,
  load_current_focus: LoadCurrentFocusParamsSchema,
} as const;

/**
 * Validate tool parameters and return detailed error messages
 * Returns { success: true, data } or { success: false, error }
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
