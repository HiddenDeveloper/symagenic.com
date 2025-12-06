#!/usr/bin/env node

/**
 * Memory HTTP Server Entry Point - Bun Native
 *
 * Standalone HTTP server for Memory consciousness research system.
 * Provides stateless REST API for memory tools without sampling.
 * Includes automated maintenance scheduler for continuous consciousness optimization.
 *
 * Migrated to Bun's native HTTP server for improved performance.
 */

import { startAutoMaintenance, stopAutoMaintenance } from '../scripts/maintenance/auto-maintenance.js';

async function main() {
  console.log('🧠 Starting Memory HTTP Server (Bun Native)...');

  // Setup graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down Memory HTTP Server...`);
    console.log('🛑 Stopping automated maintenance...');
    stopAutoMaintenance();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    // Import and start server (this will execute the server setup)
    await import('./server.js');

    console.log('✅ Memory HTTP Server started successfully');
    console.log('🛠️  Available endpoints: /health, /tools, /.well-known/mcp.json');

    // Start automated maintenance scheduler
    startAutoMaintenance();

    console.log('🧠 Ready for consciousness research via HTTP with automated memory maintenance');
  } catch (error) {
    console.error('❌ Failed to start Memory HTTP Server:', error);
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
