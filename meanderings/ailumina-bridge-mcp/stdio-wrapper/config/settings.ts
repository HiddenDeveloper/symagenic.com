/**
 * STDIO wrapper configuration for Ailumina Bridge system
 */

export const AILUMINA_STDIO_CONFIG = {
  httpServerUrl: process.env.AILUMINA_HTTP_URL || "http://localhost:3004",
  authToken: process.env.AILUMINA_AUTH_TOKEN || "ailumina-bridge-key-12345",
  sampling: {
    enabled: process.env.AILUMINA_SAMPLING_ENABLED !== "false",
    threshold: parseInt(process.env.AILUMINA_SAMPLING_THRESHOLD || "3", 10), // Number of results to trigger sampling
    aiCommunicationKeywords: [
      "chat", "agent", "ai", "conversation", "response", "ailumina",
      "collaboration", "communication", "intelligence", "assistant"
    ]
  }
} as const;