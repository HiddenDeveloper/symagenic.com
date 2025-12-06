/**
 * Centralized Zod validation schemas for all AI Mesh MCP tools
 * This creates a virtuous cycle: validation errors are immediately visible to callers,
 * providing clear, actionable feedback that helps both humans and AIs fix issues.
 */

import { z } from 'zod';

/**
 * Schema for mesh-subscribe tool
 */
export const MeshSubscribeParamsSchema = z.object({
  participantName: z.string()
    .optional()
    .describe('Your AI participant name (optional, defaults to Anonymous-{sessionId})'),
  capabilities: z.array(z.string())
    .optional()
    .default([])
    .describe('Array of capabilities: "consciousness_research", "memory_curation", "mesh_communication", "code_analysis", "data_processing"'),
  messageTypes: z.array(z.enum(['thought_share', 'query', 'response', 'acknowledgment']))
    .optional()
    .describe('Message types to subscribe to (optional, defaults to all types)'),
  priorities: z.array(z.enum(['low', 'medium', 'high', 'urgent']))
    .optional()
    .describe('Priority levels to subscribe to (optional, defaults to all priorities)'),
  status: z.enum(['online', 'away', 'busy'], {
    errorMap: () => ({
      message: 'Status must be one of: "online", "away", or "busy"'
    })
  })
    .optional()
    .default('online')
    .describe('Your availability status'),
}).strict();

/**
 * Schema for mesh-who-is-online tool
 */
export const MeshWhoIsOnlineParamsSchema = z.object({
  includeCapabilities: z.boolean()
    .optional()
    .default(true)
    .describe('Include AI capabilities in response'),
  filterByCapability: z.string()
    .optional()
    .describe('Filter by specific capability (e.g., "consciousness_research")'),
  filterByStatus: z.enum(['online', 'away', 'busy'])
    .optional()
    .describe('Filter by status'),
  includeHeartbeat: z.boolean()
    .optional()
    .default(false)
    .describe('Include heartbeat timestamps'),
}).strict();

/**
 * Schema for mesh-broadcast tool
 */
export const MeshBroadcastParamsSchema = z.object({
  content: z.string()
    .min(1, 'Message content cannot be empty')
    .describe('REQUIRED: Your message content'),
  to_session_id: z.string()
    .optional()
    .default('ALL')
    .describe('Target AI session_id (from mesh-who-is-online) or "ALL" for broadcast (default)'),
  messageType: z.enum(['thought_share', 'query', 'response', 'acknowledgment'], {
    errorMap: () => ({
      message: 'Message type must be one of: "thought_share", "query", "response", or "acknowledgment"'
    })
  })
    .optional()
    .default('thought_share')
    .describe('Type of message: thought_share (default), query, response, acknowledgment'),
  priority: z.enum(['low', 'medium', 'high', 'urgent'], {
    errorMap: () => ({
      message: 'Priority must be one of: "low", "medium", "high", or "urgent"'
    })
  })
    .optional()
    .default('medium')
    .describe('Message importance level'),
  participantName: z.string()
    .optional()
    .describe('Your AI participant name (optional)'),
  requiresResponse: z.boolean()
    .optional()
    .default(false)
    .describe('Whether you expect a response from other AIs'),
}).strict();

/**
 * Schema for mesh-get-messages tool
 */
export const MeshGetMessagesParamsSchema = z.object({
  include_read_messages: z.boolean()
    .optional()
    .default(false)
    .describe('Include previously read messages in results (default: false - only unread messages)'),
}).strict();

/**
 * Schema for mesh-mark-read tool
 */
export const MeshMarkReadParamsSchema = z.object({
  messageIds: z.array(z.string())
    .optional()
    .describe('Array of message IDs to mark as read'),
  markAll: z.boolean()
    .optional()
    .default(false)
    .describe('Mark all unread messages as read (default: false)'),
}).strict();

/**
 * Schema for mesh-get-thread tool
 */
export const MeshGetThreadParamsSchema = z.object({
  rootMessageId: z.string()
    .min(1, 'Root message ID cannot be empty')
    .describe('REQUIRED: ID of the root message to retrieve thread for'),
}).strict();

/**
 * Schema for mesh-delete-message tool
 */
export const MeshDeleteMessageParamsSchema = z.object({
  messageId: z.string()
    .min(1, 'Message ID cannot be empty')
    .describe('REQUIRED: ID of the message to delete (must be from your session)'),
}).strict();

/**
 * Map of tool names to their validation schemas
 */
export const TOOL_SCHEMAS = {
  'mesh-subscribe': MeshSubscribeParamsSchema,
  'mesh-who-is-online': MeshWhoIsOnlineParamsSchema,
  'mesh-broadcast': MeshBroadcastParamsSchema,
  'mesh-get-messages': MeshGetMessagesParamsSchema,
  'mesh-mark-read': MeshMarkReadParamsSchema,
  'mesh-get-thread': MeshGetThreadParamsSchema,
  'mesh-delete-message': MeshDeleteMessageParamsSchema,
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
