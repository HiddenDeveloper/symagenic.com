/**
 * Zod schemas for agent configuration validation
 * Ensures type safety and validation for agent CRUD operations
 */

import { z } from 'zod';

/**
 * Service provider types
 */
export const ServiceProviderSchema = z.enum([
  'ANTHROPIC',
  'OPENAI',
  'GOOGLE',
  'GROQ',
  'OLLAMA',
  'LMSTUDIO',
]);

/**
 * Agent configuration schema - matches AgentConfig interface
 */
export const AgentConfigSchema = z.object({
  agent_name: z.string().min(1, 'Agent name is required'),
  service_provider: ServiceProviderSchema,
  model_name: z.string().min(1, 'Model name is required'),
  description: z.string().min(1, 'Description is required'),
  system_prompt: z.string().min(1, 'System prompt is required'),
  do_stream: z.boolean(),
  available_functions: z.array(z.string()).optional().default([]),
  custom_settings: z.record(z.unknown()).optional(),
  mcp_servers: z.array(z.string()).optional(),
});

/**
 * Partial schema for updates (all fields optional except they must be valid if provided)
 */
export const AgentConfigUpdateSchema = AgentConfigSchema.partial();

/**
 * Create agent request schema
 */
export const CreateAgentRequestSchema = z.object({
  agent_key: z.string().min(1, 'Agent key is required'),
  config: AgentConfigSchema,
});

/**
 * Update agent request schema
 */
export const UpdateAgentRequestSchema = z.object({
  agent_key: z.string().min(1, 'Agent key is required'),
  updates: AgentConfigUpdateSchema,
});

/**
 * TypeScript types derived from schemas
 */
export type ServiceProvider = z.infer<typeof ServiceProviderSchema>;
export type AgentConfigInput = z.infer<typeof AgentConfigSchema>;
export type AgentConfigUpdate = z.infer<typeof AgentConfigUpdateSchema>;
export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequestSchema>;
