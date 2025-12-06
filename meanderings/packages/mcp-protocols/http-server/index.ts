#!/usr/bin/env node

/**
 * HTTP Server Entry Point
 * 
 * Clean MCP server implementation with HTTP transport.
 * No sampling capability - focuses on stateless REST/JSON-RPC operations.
 */

import { loadHttpServerConfig, validateConfig } from "./config/settings.js";
import { createHttpServer } from "./server.js";

async function main() {
  try {
    // Load and validate configuration
    const config = loadHttpServerConfig();
    validateConfig(config);

    console.log("🚀 Starting MCP HTTP Server");
    console.log(`📍 Host: ${config.host}`);
    console.log(`🔌 Port: ${config.port}`);
    console.log(`🔐 Auth Required: ${config.requireAuth ? "Yes" : "No"}`);
    console.log(`🔑 API Key: ${config.apiKey}`);

    // Create server
    const { handleRequest } = createHttpServer(config);

    // Start Bun native server
    Bun.serve({
      port: config.port,
      hostname: config.host,
      fetch: handleRequest,
    });

    console.log(`✅ HTTP Server running on http://${config.host}:${config.port}`);
    console.log(`📚 API Documentation: http://${config.host}:${config.port}`);
    console.log(`🏥 Health Check: http://${config.host}:${config.port}/health`);
    console.log(`🔧 Tools: http://${config.host}:${config.port}/mcp/tools`);
    console.log(`📄 Resources: http://${config.host}:${config.port}/mcp/resources`);
    console.log(`🌐 JSON-RPC: http://${config.host}:${config.port}/mcp/rpc`);
    console.log("📝 Note: This HTTP server does not support sampling");

    // Graceful shutdown
    const shutdown = () => {
      console.log("\n🛑 Shutting down HTTP server gracefully...");
      console.log("✅ HTTP server closed");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (error) {
    console.error("💥 Failed to start HTTP server:", error);
    process.exit(1);
  }
}

main();