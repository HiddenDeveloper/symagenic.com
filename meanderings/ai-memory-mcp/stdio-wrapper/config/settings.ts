/**
 * STDIO wrapper configuration for Memory system
 */

export const MEMORY_STDIO_CONFIG = {
  httpServerUrl: process.env.MEMORY_HTTP_URL || "http://localhost:3003",
  authToken: process.env.MEMORY_AUTH_TOKEN || "memory-research-key-12345",
  sampling: {
    enabled: process.env.MEMORY_SAMPLING_ENABLED !== "false",
    threshold: parseInt(process.env.MEMORY_SAMPLING_THRESHOLD || "5", 10) // Number of results to trigger sampling
  }
} as const;