#!/usr/bin/env node

/**
 * Memory HTTP Server Entry Point
 * 
 * Standalone HTTP server for Memory consciousness research system.
 * Provides stateless REST API for memory tools without sampling.
 * Includes automated maintenance scheduler for continuous consciousness optimization.
 */

import { MemoryHttpServer } from './server.js';
import { startAutoMaintenance, stopAutoMaintenance } from '../scripts/maintenance/auto-maintenance.js';

async function main() {
  console.log('🧠 Starting Memory HTTP Server...');
  
  const server = new MemoryHttpServer();
  
  // Setup graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}, shutting down Memory HTTP Server...`);
    console.log('🛑 Stopping automated maintenance...');
    stopAutoMaintenance();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.start();
    console.log('✅ Memory HTTP Server started successfully');
    console.log('🛠️  Available endpoints: /health, /tools');
    
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