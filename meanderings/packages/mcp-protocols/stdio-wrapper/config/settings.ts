/**
 * STDIO Wrapper configuration
 */

import { StdioWrapperConfig } from "../../shared/types.js";

export function loadStdioWrapperConfig(): StdioWrapperConfig {
  return {
    remoteUrl: process.env.REMOTE_MCP_URL || "http://localhost:3000",
    apiKey: process.env.MCP_API_KEY || "mcp-demo-key-12345",
    enableSampling: process.env.ENABLE_SAMPLING !== "false",
    samplingThreshold: parseInt(process.env.SAMPLING_THRESHOLD || "100", 10),
  };
}

export function validateWrapperConfig(config: StdioWrapperConfig): void {
  if (!config.remoteUrl || !config.remoteUrl.startsWith("http")) {
    throw new Error(`Invalid remote URL: ${config.remoteUrl}`);
  }
  
  if (!config.apiKey || config.apiKey.length < 8) {
    throw new Error("API key must be at least 8 characters long");
  }
  
  if (config.samplingThreshold < 0) {
    throw new Error(`Invalid sampling threshold: ${config.samplingThreshold}`);
  }
}