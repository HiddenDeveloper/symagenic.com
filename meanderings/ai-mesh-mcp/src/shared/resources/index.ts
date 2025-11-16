import { Resource } from "@modelcontextprotocol/sdk/types.js";
import type { WebSocketService } from "../services/websocket.service.js";

// Clean WebSocket-only mesh resources
const meshInfoResource: Resource = {
  uri: "mesh://info",
  name: "Mesh Network Info",
  description: "Current WebSocket mesh network information",
  mimeType: "application/json"
};

const meshStatusResource: Resource = {
  uri: "mesh://status",
  name: "Mesh Network Status",
  description: "WebSocket mesh network status and connections",
  mimeType: "application/json"
};

const meshMessagesResource: Resource = {
  uri: "mesh://messages",
  name: "Mesh Message History",
  description: "Recent messages broadcast to the mesh network",
  mimeType: "application/json"
};

// Export resource definitions for MCP registration
export const resources: Resource[] = [
  meshInfoResource,
  meshStatusResource,
  meshMessagesResource
];

// Resource handler map
export const resourceHandlers = {
  "mesh://info": (webSocketService: WebSocketService) => getMeshInfo(webSocketService),
  "mesh://status": (webSocketService: WebSocketService) => getMeshStatus(webSocketService),
  "mesh://messages": (webSocketService: WebSocketService) => getMeshMessages(webSocketService)
};

// Main resource handler
export async function getResource(
  uri: string,
  webSocketService: WebSocketService
): Promise<string> {
  const handler = resourceHandlers[uri as keyof typeof resourceHandlers];

  if (!handler) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  if (typeof handler === "function") {
    return await handler(webSocketService);
  }

  throw new Error(`Invalid handler for resource: ${uri}`);
}

// WebSocket mesh resource implementations
async function getMeshInfo(webSocketService: WebSocketService): Promise<string> {
  return JSON.stringify({
    name: "AI Mesh WebSocket Network",
    version: "1.0.0",
    transport: "WebSocket-only",
    connections: {
      active: webSocketService.getConnectionCount(),
      total: webSocketService.getConnectionCount()
    },
    capabilities: ["real-time messaging", "presence detection", "AI discovery"],
    timestamp: new Date().toISOString()
  }, null, 2);
}

async function getMeshStatus(webSocketService: WebSocketService): Promise<string> {
  return JSON.stringify({
    status: "operational",
    connections: webSocketService.getConnectionCount(),
    websocket: {
      enabled: true,
      transport: "Socket.IO"
    },
    timestamp: new Date().toISOString()
  }, null, 2);
}

async function getMeshMessages(webSocketService: WebSocketService): Promise<string> {
  const messages = webSocketService.getMessageHistory(20); // Get last 20 messages
  
  return JSON.stringify({
    messageHistory: messages.map(msg => ({
      id: msg.id,
      type: msg.messageType,
      content: msg.content,
      fromSession: msg.fromSession,
      participantName: msg.participantName,
      priority: msg.priority,
      timestamp: msg.timestamp,
      requiresResponse: msg.requiresResponse
    })),
    totalMessages: messages.length,
    timestamp: new Date().toISOString()
  }, null, 2);
}

// Get resource by URI
export function getResourceDefinition(uri: string): Resource | undefined {
  return resources.find(resource => resource.uri === uri);
}

// Get all resource URIs
export function getResourceUris(): string[] {
  return resources.map(resource => resource.uri);
}