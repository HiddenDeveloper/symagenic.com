#!/usr/bin/env node

/**
 * Qdrant Facts HTTP Server Entry Point
 *
 * Standalone HTTP server for external facts pool management.
 * Provides stateless REST API for facts tools without sampling.
 */

import { FactsHttpServer } from './server.js';

async function main() {
  console.log('📦 Starting Qdrant Facts HTTP Server...');

  const server = new FactsHttpServer();

  // Setup graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down Qdrant Facts HTTP Server...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.start();
    console.log('✅ Qdrant Facts HTTP Server started successfully');
    console.log('🛠️  Available endpoints: /health, /tools');
    console.log('📦 Ready for external facts pool management via HTTP');
  } catch (error) {
    console.error('❌ Failed to start Qdrant Facts HTTP Server:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}
