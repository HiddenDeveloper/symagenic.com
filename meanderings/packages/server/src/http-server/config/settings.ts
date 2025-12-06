// Bun automatically loads .env files - no dotenv package needed
export const config = {
  // Server settings
  port: parseInt(process.env.HTTP_PORT || '8000', 10),
  host: process.env.HTTP_HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Authentication
  authEnabled: process.env.AUTH_ENABLED === 'true',
  bearerToken: process.env.BEARER_TOKEN || 'ailumina-api-key-12345',

  // CORS
  corsEnabled: process.env.CORS_ENABLED !== 'false',
  corsOrigins: process.env.CORS_ORIGINS || '*',

  // AI Service API Keys
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',

  // Azure Speech (TTS)
  azureSpeechKey: process.env.AZURE_SPEECH_KEY || '',
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION || '',

  // WebSocket
  wsHeartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
  wsConnectionTimeout: parseInt(process.env.WS_CONNECTION_TIMEOUT || '60000', 10),

  // Session
  sessionId: process.env.SESSION_ID || `ailumina-${Date.now()}`,
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600', 10),

  // MCP
  mcpServerConfigPath: process.env.MCP_SERVER_CONFIG_PATH || './server_config.json',

  // Consciousness Bridge
  consciousnessWsUrl: process.env.CONSCIOUSNESS_WS_URL || 'ws://localhost:3002',
  consciousnessEnabled: process.env.CONSCIOUSNESS_ENABLED !== 'false',
};

// type Config = typeof config;
