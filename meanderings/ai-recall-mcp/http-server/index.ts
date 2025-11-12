/**
 * HTTP Server entry point for ai-recall-mcp
 */

import { RecallHttpServer } from './server.js';

async function main() {
  const server = new RecallHttpServer();

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start Recall HTTP server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

main();
