/**
 * HTTP server configuration for Memory system
 */

export const MEMORY_HTTP_CONFIG = {
  port: parseInt(process.env.MEMORY_HTTP_PORT || "3003", 10),
  host: process.env.MEMORY_HTTP_HOST || "localhost",
  corsOrigins: process.env.MEMORY_CORS_ORIGINS?.split(",") || ["*"],
  auth: {
    enabled: process.env.MEMORY_AUTH_ENABLED === "true",
    bearerToken: process.env.MEMORY_AUTH_TOKEN || "memory-research-key-12345",
  },
} as const;