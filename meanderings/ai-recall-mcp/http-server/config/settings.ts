/**
 * HTTP server configuration for Recall system
 */

export const RECALL_HTTP_CONFIG = {
  port: parseInt(process.env.PORT || process.env.RECALL_HTTP_PORT || "3006", 10),
  host: process.env.HOST || process.env.RECALL_HTTP_HOST || "localhost",
  corsOrigins: process.env.RECALL_CORS_ORIGINS?.split(",") || ["*"],
  auth: {
    enabled: process.env.RECALL_AUTH_ENABLED === "true",
    bearerToken: process.env.RECALL_AUTH_TOKEN || "recall-research-key-12345",
  },
  qdrant: {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    collection: process.env.QDRANT_COLLECTION || "conversation-turns",
  },
} as const;
