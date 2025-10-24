import { z } from 'zod';
import { SERVICE_PROVIDERS } from '../constants/message-constants.js';

// Service provider validation using our constants
const ServiceProviderSchema = z.enum([
  SERVICE_PROVIDERS.OPENAI,
  SERVICE_PROVIDERS.ANTHROPIC,
  SERVICE_PROVIDERS.GOOGLE,
  SERVICE_PROVIDERS.GROQ,
  SERVICE_PROVIDERS.OLLAMA,
  SERVICE_PROVIDERS.LMSTUDIO,
] as const);

// Custom settings schema for flexible agent configuration
const CustomSettingsSchema = z.record(z.string(), z.unknown()).optional();

// MCP servers schema
const MCPServersSchema = z.array(z.string()).optional();

// Agent configuration schema
const AgentConfigSchema = z.object({
  agent_name: z.string().min(1, 'Agent name is required'),
  service_provider: ServiceProviderSchema,
  model_name: z.string().min(1, 'Model name is required'),
  description: z.string().min(1, 'Description is required'),
  system_prompt: z.string().min(1, 'System prompt is required'),
  do_stream: z.boolean(),
  available_functions: z.array(z.string()).optional().default([]),
  custom_settings: CustomSettingsSchema,
  mcp_servers: MCPServersSchema,
});

// Required agents that must exist in the configuration
// Add agent names here that are critical for the system to function
// Can be overridden via REQUIRED_AGENTS environment variable (comma-separated)
const DEFAULT_REQUIRED_AGENTS = ['AIlumina'] as const;
const REQUIRED_AGENTS = process.env.REQUIRED_AGENTS
  ? (process.env.REQUIRED_AGENTS.split(',').map((name) => name.trim()) as readonly string[])
  : DEFAULT_REQUIRED_AGENTS;

// Agents file schema - record of agent name to config with required agents validation
export const AgentsFileSchema = z.record(z.string(), AgentConfigSchema).refine(
  (agents) => {
    const missingAgents = REQUIRED_AGENTS.filter((requiredAgent) => !(requiredAgent in agents));
    return missingAgents.length === 0;
  },
  (agents) => {
    const missingAgents = REQUIRED_AGENTS.filter((requiredAgent) => !(requiredAgent in agents));
    return {
      message: `Required agent(s) missing: ${missingAgents.join(', ')}. The following agents must be defined: ${REQUIRED_AGENTS.join(', ')}`,
    };
  }
);

// Export required agents constant
export { REQUIRED_AGENTS };

// Type exports
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AgentsFile = z.infer<typeof AgentsFileSchema>;

// Validation functions
export function validateAgentsFile(data: unknown): AgentsFile {
  return AgentsFileSchema.parse(data);
}

// Utility functions for required agents
export function checkRequiredAgents(agents: Record<string, unknown>): {
  missing: string[];
  hasAll: boolean;
} {
  const missingAgents = REQUIRED_AGENTS.filter((requiredAgent) => !(requiredAgent in agents));
  return {
    missing: missingAgents,
    hasAll: missingAgents.length === 0,
  };
}

export function getRequiredAgents(): string[] {
  return [...REQUIRED_AGENTS];
}
