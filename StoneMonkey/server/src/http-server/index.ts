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
