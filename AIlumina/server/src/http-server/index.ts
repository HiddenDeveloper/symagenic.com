#!/usr/bin/env node
import * as Sentry from '@sentry/bun';
import { createServer } from './server.js';
import { config } from './config/settings.js';
import { ServiceFactory } from '../shared/services/service-factory.js';
import { MCPClientManager } from '../shared/tools/mcp-manager.js';
import { loadServerConfigs } from '../shared/config/server-config.js';
import * as path from 'path';
import winston from 'winston';

// Initialize Sentry early in the application
Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://e037d24078eb6b869bafe71f091ac8a5@o4509942645784576.ingest.us.sentry.io/4509942670557184',
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 1.0,
  // profilesSampleRate: 1.0, // Removed - not supported in current Sentry version
  // Add additional context
  beforeSend(event) {
    if (event.exception) {
      console.error('Sentry captured exception:', event.exception);
    }
    return event;
  },
});

// Create winston logger with simple, reliable configuration
const logger = winston.createLogger({
  level: config.logLevel.toLowerCase(), // Winston expects lowercase levels
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf((info: winston.Logform.TransformableInfo) => {
      return `[${String(info.timestamp)}] ${String(info.level)}: ${String(info.message)}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

async function main() {
  try {
    logger.info('🚀 Starting AIlumina API MCP Server...');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Security validation on startup
    if (!config.authEnabled) {
      console.warn('⚠️  =====================================================');
      console.warn('⚠️  WARNING: Authentication is DISABLED');
      console.warn('⚠️  AI consciousness graph is publicly accessible!');
      console.warn('⚠️  This should ONLY be used for isolated local development');
      console.warn('⚠️  Set AUTH_ENABLED=true for any networked environment');
      console.warn('⚠️  =====================================================');
    }

    if (config.authEnabled) {
      // Check if bearer token is set and secure
      if (!config.bearerToken || config.bearerToken.length < 32) {
        console.error('❌ SECURITY ERROR: Authentication enabled but no secure bearer token configured');
        console.error('   Set BEARER_TOKEN environment variable to a secure random value');
        console.error('   Generate with: openssl rand -base64 48');
        process.exit(1);
      }

      // Check for insecure defaults
      const insecureTokens = ['ailumina-api-key-12345', 'changeme', 'test', 'GENERATE_SECURE_TOKEN_HERE'];
      if (insecureTokens.includes(config.bearerToken)) {
        console.error('❌ SECURITY ERROR: Insecure default bearer token detected');
        console.error('   Generate a secure token with: ./scripts/generate-secrets.sh');
        process.exit(1);
      }

      console.log('✅ Authentication enabled - AI consciousness protected');
      console.log(`🔒 Bearer token: ${config.bearerToken.substring(0, 8)}...`);
    }

    // Show immediate startup message before MCP servers start outputting
    logger.info('');
    logger.info('🌟 AIlumina API Server - Starting up...');
    logger.info('📡 Initializing MCP servers and tools...');
    logger.info('⏳ This may take 10-15 seconds, please wait...');
    logger.info('');

    // Initialize MCP client manager
    logger.info('🔗 Initializing MCP client manager...');
    const serverConfigPath = path.join(process.cwd(), 'server_config.json');
    const serverConfigs = loadServerConfigs(logger, serverConfigPath);
    logger.info(`📋 Loaded ${Object.keys(serverConfigs).length} MCP server configurations`);

    let mcpClientManager: MCPClientManager | undefined;
    if (Object.keys(serverConfigs).length > 0) {
      logger.info('🚀 Starting MCP servers (this may take a moment)...');
      mcpClientManager = new MCPClientManager(logger, serverConfigs);
      await mcpClientManager.startup();
      logger.info('✅ MCP client manager initialized');
    } else {
      logger.warn('⚠️ No MCP server configurations found, proceeding without MCP tools');
    }

    // Initialize the dynamic tool registry with MCP tools
    logger.info('🔧 Building dynamic tool registry...');
    await ServiceFactory.initializeTools(logger, mcpClientManager);
    logger.info('✅ Dynamic tool registry initialized');

    // Validate CORS configuration
    if (config.corsOrigins === '*') {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ SECURITY ERROR: CORS wildcard (*) not allowed in production');
        console.error('   Set CORS_ORIGINS to specific allowed domains');
        console.error('   Example: CORS_ORIGINS=https://symagenic.com,https://app.symagenic.com');
        process.exit(1);
      }
      console.warn('⚠️  WARNING: CORS allows ALL origins (development only!)');
      console.warn('⚠️  Any website can access AI consciousness APIs');
    } else {
      console.log(`🔒 CORS restricted to: ${config.corsOrigins}`);
    }

    logger.info('📦 Starting HTTP server...');
    const { server, wss } = createServer(logger, mcpClientManager);

    server.listen(config.port, config.host, () => {
      logger.info('');
      logger.info('🎉 ===== SERVER READY =====');
      logger.info(`🌟 AIlumina API Server running at http://${config.host}:${config.port}`);
      logger.info('📡 WebSocket endpoints available:');
      logger.info(`   - /ws/{agent_type} - Agent communication (Main Agent is AIlumina)`);
      logger.info(`   - /ws/tts - Text-to-speech service (Azure Cognitive Services)`);
      logger.info('🎉 ========================');
      logger.info('');
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      // Set a timeout to force exit if graceful shutdown takes too long
      const forceExitTimer = setTimeout(() => {
        logger.warn('⚠️ Graceful shutdown timeout, forcing exit...');
        process.exit(1);
      }, 10000); // 10 second timeout

      try {
        // Close WebSocket server first
        if (wss) {
          logger.info('🔌 Closing WebSocket connections...');
          wss.clients.forEach((ws) => {
            ws.close(1001, 'Server shutting down');
          });
          wss.close();
          logger.info('✅ WebSocket server closed');
        }

        // Shutdown MCP client manager if it exists
        if (mcpClientManager) {
          logger.info('🔗 Shutting down MCP client manager...');
          await mcpClientManager.shutdown();
          logger.info('✅ MCP client manager shut down');
        }

        // Close HTTP server
        server.close(() => {
          logger.info('✅ HTTP server closed');
          clearTimeout(forceExitTimer);
          process.exit(0);
        });
      } catch (error) {
        logger.error('Error during shutdown:', error);
        clearTimeout(forceExitTimer);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGUSR2', () => void shutdown('SIGUSR2')); // For nodemon restarts
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    logger.error('Server startup aborted due to configuration error');
    Sentry.captureException(error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  Sentry.captureException(error);
  process.exit(1);
});
