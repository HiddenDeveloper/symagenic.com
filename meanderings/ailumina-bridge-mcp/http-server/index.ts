#!/usr/bin/env node

/**
 * Ailumina Bridge HTTP Server Entry Point
 * 
 * Standalone HTTP server for Ailumina Bridge AI communication system.
 * Provides stateless REST API for Ailumina tools without sampling.
 */

import { AiluminaHttpServer } from './server.js';

async function main() {
  console.log('🌐 Starting Ailumina Bridge HTTP Server...');
  
  const server = new AiluminaHttpServer();
  
  // Setup graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down Ailumina Bridge HTTP Server...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.start();
    console.log('✅ Ailumina Bridge HTTP Server started successfully');
    console.log('🛠️  Available endpoints: /health, /tools');
    console.log('🌐 Ready for AI communication via HTTP');
  } catch (error) {
    console.error('❌ Failed to start Ailumina Bridge HTTP Server:', error);
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