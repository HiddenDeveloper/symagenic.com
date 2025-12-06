/**
 * Configuration for Qdrant Facts STDIO Wrapper
 */

export const FACTS_STDIO_CONFIG = {
  http: {
    url: process.env.FACTS_HTTP_URL || 'http://localhost:3005',
    authToken: process.env.FACTS_AUTH_TOKEN || 'facts-research-key-12345'
  }
};
