import { z } from 'zod';
import { TRANSPORT_TYPES } from '../constants/message-constants.js';

// Environment variables schema - optional for STDIO
const EnvironmentVariablesSchema = z.record(z.string(), z.string());

// STDIO server configuration - strict schema
const StdioServerConfigSchema = z
  .object({
    transport_type: z.literal(TRANSPORT_TYPES.STDIO),
    command: z.string().min(1, 'Command is required for STDIO servers'),
    args: z.array(z.string()).optional(),
    env: EnvironmentVariablesSchema.optional(),
  })
  .strict(); // Reject extra properties

// HTTP server configuration - strict schema
const HttpServerConfigSchema = z
  .object({
    transport_type: z.literal(TRANSPORT_TYPES.HTTP),
    url: z.string().url('URL must be a valid URL for HTTP servers'),
    auth_token: z.string().optional(),
  })
  .strict(); // Reject extra properties

// Union schema for server configurations
// Using discriminatedUnion for better error messages
const ServerConfigSchema = z.discriminatedUnion('transport_type', [
  StdioServerConfigSchema,
  HttpServerConfigSchema,
]);

// Server config file schema
export const ServerConfigFileSchema = z
  .object({
    mcpServers: z.record(z.string().min(1, 'Server name cannot be empty'), ServerConfigSchema),
  })
  .strict();

// Type exports
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type ServerConfigFile = z.infer<typeof ServerConfigFileSchema>;

// Validation function with detailed error reporting
export function validateServerConfigFile(data: unknown): ServerConfigFile {
  try {
    return ServerConfigFileSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format the error nicely
      const issues = error.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return `  - ${path}: ${issue.message}`;
        })
        .join('\n');

      throw new Error(
        `Server configuration validation failed:\n${issues}\n\nCommon issues:\n  - Use 'transport_type' not 'type'\n  - HTTP servers need 'url'\n  - STDIO servers need 'command'`
      );
    }
    throw error;
  }
}
