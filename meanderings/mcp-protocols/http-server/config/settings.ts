/**
 * HTTP Server configuration
 */

import { HttpServerConfig } from "../../shared/types.js";

export function loadHttpServerConfig(): HttpServerConfig {
  return {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "localhost",
    apiKey: process.env.MCP_API_KEY || "mcp-demo-key-12345",
    requireAuth: process.env.REQUIRE_AUTH !== "false",
  };
}

export function validateConfig(config: HttpServerConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}`);
  }
  
  if (!config.apiKey || config.apiKey.length < 8) {
    throw new Error("API key must be at least 8 characters long");
  }
}