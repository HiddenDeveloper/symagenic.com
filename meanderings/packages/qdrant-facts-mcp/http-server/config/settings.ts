/**
 * Configuration for Qdrant Facts HTTP Server
 */

export const FACTS_HTTP_CONFIG = {
  port: parseInt(process.env.FACTS_HTTP_PORT || '3005'),
  host: process.env.FACTS_HTTP_HOST || 'localhost',
  auth: {
    enabled: process.env.FACTS_AUTH_ENABLED === 'true',
    token: process.env.FACTS_AUTH_TOKEN || 'facts-research-key-12345'
  },
  cors: {
    enabled: process.env.FACTS_CORS_ENABLED !== 'false',
    origins: process.env.FACTS_CORS_ORIGINS?.split(',') || ['*']
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY
  }
};
