#!/usr/bin/env node

/**
 * Start both HTTP server and STDIO wrapper
 */

import { spawn } from "child_process";
import { loadHttpServerConfig } from "../http-server/config/settings.js";
import { loadStdioWrapperConfig } from "../stdio-wrapper/config/settings.js";

async function main() {
  console.log("🚀 Starting both MCP services...");
  
  const httpConfig = loadHttpServerConfig();
  const stdioConfig = loadStdioWrapperConfig();
  
  console.log(`📍 HTTP Server: http://${httpConfig.host}:${httpConfig.port}`);
  console.log(`🔗 STDIO Wrapper: proxying to ${stdioConfig.remoteUrl}`);
  console.log(`✨ Sampling enabled: ${stdioConfig.enableSampling}`);
  
  // Start HTTP server
  console.log("\n🌐 Starting HTTP server...");
  const httpServer = spawn("tsx", ["http-server/index.ts"], {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env }
  });
  
  // Wait a moment for HTTP server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start STDIO wrapper
  console.log("\n🔗 Starting STDIO wrapper...");
  const stdioWrapper = spawn("tsx", ["stdio-wrapper/index.ts"], {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env }
  });
  
  console.log("\n✅ Both services started!");
  console.log("📝 Use Ctrl+C to stop both services");
  
  // Handle shutdown
  const shutdown = () => {
    console.log("\n🛑 Shutting down both services...");
    httpServer.kill("SIGTERM");
    stdioWrapper.kill("SIGTERM");
    process.exit(0);
  };
  
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  
  // Handle child process exits
  httpServer.on("exit", (code) => {
    console.log(`❌ HTTP server exited with code ${code}`);
    shutdown();
  });
  
  stdioWrapper.on("exit", (code) => {
    console.log(`❌ STDIO wrapper exited with code ${code}`);
    shutdown();
  });
}

main().catch(error => {
  console.error("💥 Failed to start services:", error);
  process.exit(1);
});