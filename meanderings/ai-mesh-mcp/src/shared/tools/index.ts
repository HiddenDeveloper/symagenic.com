import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { WebSocketService } from "../services/websocket.service.js";
import type { SessionPersistenceService } from "../services/session-persistence.service.js";
import type { MessagePersistenceService } from "../services/message-persistence.service.js";

// Import mesh tools with persistence support
import { meshSubscribeTool, executeMeshSubscribe } from "./mesh-subscribe.js";
import { meshWhoIsOnlineTool, executeMeshWhoIsOnline } from "./mesh-who-is-online.js";
import { meshBroadcastTool, executeMeshBroadcast } from "./mesh-broadcast.js";
import { meshGetMessagesTool, executeMeshGetMessages } from "./mesh-get-messages.js";
import { meshMarkReadTool, executeMeshMarkRead } from "./mesh-mark-read.js";
import { meshGetThreadTool, executeMeshGetThread } from "./mesh-get-thread.js";
import { meshDeleteMessageTool, executeMeshDeleteMessage } from "./mesh-delete-message.js";

// Export tool definitions for MCP registration
export const tools: Tool[] = [
  meshSubscribeTool,
  meshWhoIsOnlineTool,
  meshBroadcastTool,
  meshGetMessagesTool,
  meshMarkReadTool,
  meshGetThreadTool,
  meshDeleteMessageTool
];

// Tool execution with persistence services
export async function executeTool(
  toolName: string,
  webSocketService: WebSocketService,
  sessionPersistence: SessionPersistenceService,
  messagePersistence: MessagePersistenceService,
  sessionId: string,
  input: unknown
): Promise<any> {
  switch (toolName) {
    case "mesh-subscribe":
      return await executeMeshSubscribe(webSocketService, sessionPersistence, sessionId, input);
    case "mesh-who-is-online":
      return await executeMeshWhoIsOnline(webSocketService, input);
    case "mesh-broadcast":
      return await executeMeshBroadcast(webSocketService, sessionPersistence, messagePersistence, sessionId, input);
    case "mesh-get-messages":
      return await executeMeshGetMessages(webSocketService, sessionPersistence, messagePersistence, sessionId, input as any);
    case "mesh-mark-read":
      return await executeMeshMarkRead(sessionPersistence, messagePersistence, sessionId, input as any);
    case "mesh-get-thread":
      return await executeMeshGetThread(sessionPersistence, messagePersistence, sessionId, input as any);
    case "mesh-delete-message":
      return await executeMeshDeleteMessage(sessionPersistence, messagePersistence, sessionId, input as any);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Get tool by name
export function getTool(toolName: string): Tool | undefined {
  return tools.find(tool => tool.name === toolName);
}

// Get all tool names
export function getToolNames(): string[] {
  return tools.map(tool => tool.name);
}