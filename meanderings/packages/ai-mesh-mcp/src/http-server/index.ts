#!/usr/bin/env node

import { AiMeshHttpServer } from "./server.js";

async function main() {
  console.log("🚀 Starting AI Mesh HTTP Server...");
  
  const server = new AiMeshHttpServer();
  
  try {
    await server.start();
    console.log("✅ AI Mesh WebSocket Server is ready for real-time AI communication!");
    console.log("");
    console.log("📋 Server Information:");
    console.log(`   • WebSocket Connections: ${server.getWebSocketService().getConnectionCount()}`);
    console.log(`   • Transport: WebSocket-only`);
    console.log(`   • Real-time: Enabled`);
    console.log("");
    console.log("🔗 Available Endpoints:");
    console.log("   • GET  /          - Server information");
    console.log("   • GET  /health    - Health check");
    console.log("   • GET  /docs      - API documentation");
    console.log("   • POST /tools/call - Execute mesh tools");
    console.log("   • GET  /resources - List mesh resources");
    console.log("");
    console.log("🛠️  Available Tools:");
    console.log("   • mesh-subscribe   - Subscribe to real-time mesh updates");
    console.log("   • mesh-who-is-online - Discover connected AI instances");
    console.log("");
    console.log("📊 Available Resources:");
    console.log("   • mesh://info     - WebSocket mesh network information");
    console.log("   • mesh://status   - Network status and connections");
    console.log("");
    console.log("⚡ Ready for real-time AI-to-AI communication via WebSocket!");
    
  } catch (error) {
    console.error("❌ Failed to start AI Mesh HTTP Server:", error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});