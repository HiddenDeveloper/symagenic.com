/**
 * Server info resource implementation
 */

import { ResourceContent } from "../types.js";

export const serverInfoResourceDefinition = {
  uri: "server://info",
  mimeType: "text/plain",
  name: "Server Information",
  description: "Basic information about this MCP server",
};

export function createServerInfoResource(): ResourceContent {
  const infoText = `MCP Remote Server

This is a dual-transport MCP server implementation that provides:
- HTTP-accessible endpoints for MCP operations
- STDIO wrapper with bidirectional sampling capability
- Clean separation between transport layers
- Shared tool implementations for consistency

Architecture:
- HTTP Server: Stateless REST/JSON-RPC API for web clients
- STDIO Wrapper: MCP-compliant proxy with sampling support
- Shared Logic: Tools and resources implemented once

Tools Available:
- echo: Echo back provided text
- get_time: Get current server time
- calculate: Perform arithmetic calculations
- get_weather: Get simulated weather data

Designed to work seamlessly with VS Code, Claude Desktop, and web clients.
Built with TypeScript, Express, and the official MCP SDK.`;

  return {
    contents: [
      {
        uri: "server://info",
        mimeType: "text/plain",
        text: infoText,
      },
    ],
  };
}