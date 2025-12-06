/**
 * Server status resource implementation
 */

import { ResourceContent, ServerStatus } from "../types.js";

export const serverStatusResourceDefinition = {
  uri: "server://status",
  mimeType: "application/json",
  name: "Server Status",
  description: "Current status and metrics of this MCP server",
};

export function createServerStatusResource(
  startTime: number,
  requestCount: number
): ResourceContent {
  const status: ServerStatus = {
    status: "running",
    uptime: (Date.now() - startTime) / 1000,
    memory: process.memoryUsage(),
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    requestCount,
  };

  return {
    contents: [
      {
        uri: "server://status",
        mimeType: "application/json",
        text: JSON.stringify(status, null, 2),
      },
    ],
  };
}