/**
 * HTTP server configuration for Ailumina Bridge system
 */

export const AILUMINA_HTTP_CONFIG = {
  port: parseInt(process.env.AILUMINA_HTTP_PORT || "3004", 10),
  host: process.env.AILUMINA_HTTP_HOST || "localhost",
  corsOrigins: process.env.AILUMINA_CORS_ORIGINS?.split(",") || ["*"],
  auth: {
    enabled: process.env.AILUMINA_AUTH_ENABLED === "true",
    bearerToken: process.env.AILUMINA_AUTH_TOKEN || "ailumina-bridge-key-12345",
  },
} as const;