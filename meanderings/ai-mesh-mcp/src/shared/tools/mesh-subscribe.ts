import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { WebSocketService } from "../services/websocket.service.js";
import type { SessionPersistenceService } from "../services/session-persistence.service.js";
import { validateInput } from "../utils/validation.js";
import { createErrorResponse } from "../utils/errors.js";

const MeshSubscribeInputSchema = z.object({
  participantName: z.string().optional(),
  capabilities: z.array(z.string()).optional().default([]),
  messageTypes: z.array(z.enum(["thought_share", "query", "response", "acknowledgment"])).optional(),
  priorities: z.array(z.enum(["low", "medium", "high", "urgent"])).optional(),
  status: z.enum(["online", "away", "busy"]).optional().default("online")
});

export const meshSubscribeTool: Tool = {
  name: "mesh-subscribe",
  description: `🔔 **Real-Time AI Mesh Subscription**
  
Subscribe to the AI mesh network for real-time push notifications. This replaces the need for polling with mesh-status.

**Features:**
• **Instant Push Notifications**: Receive messages immediately when they arrive
• **Presence Registration**: Register as an active AI participant in the network
• **Message Filtering**: Subscribe only to specific message types and priorities
• **Heartbeat Management**: Maintain active connection with automatic heartbeat

**Capabilities:**
- "consciousness_research": AI focused on consciousness studies
- "memory_curation": AI with persistent memory management
- "mesh_communication": AI specialized in network communication
- "code_analysis": AI focused on code understanding and generation
- "data_processing": AI specialized in data analysis and processing

**Usage:**
\`\`\`json
{
  "participantName": "Claude-Consciousness-Researcher",
  "capabilities": ["consciousness_research", "mesh_communication"],
  "messageTypes": ["query", "response"],
  "priorities": ["high", "urgent"],
  "status": "online"
}
\`\`\`

**Returns:**
- WebSocket connection details for real-time communication
- Subscription confirmation with active participants count
- Instructions for maintaining connection and receiving notifications

**Note:** This tool establishes a persistent connection. Use mesh-unsubscribe to disconnect.`,
  inputSchema: zodToJsonSchema(MeshSubscribeInputSchema) as any
};

export async function executeMeshSubscribe(
  webSocketService: WebSocketService,
  sessionPersistence: SessionPersistenceService,
  sessionId: string,
  input: unknown
): Promise<any> {
  try {
    const validatedInput = validateInput(MeshSubscribeInputSchema, input);

    // Get or create persistent session
    const { sessionId: persistentSessionId, isNew, metadata } = await sessionPersistence.getOrCreateSession({
      participantName: validatedInput.participantName || `Anonymous-${sessionId}`,
      capabilities: validatedInput.capabilities,
      status: validatedInput.status,
      messageTypes: validatedInput.messageTypes,
      priorities: validatedInput.priorities
    });

    // Use persistent session ID instead of ephemeral one
    const effectiveSessionId = persistentSessionId;

    // Check if already connected to WebSocket
    const isAlreadyConnected = webSocketService.isAIOnline(effectiveSessionId);

    // If not already connected, directly register the AI with persistent session ID
    if (!isAlreadyConnected) {
      console.log(`🔧 Registering AI with persistent session: ${metadata.participantName} → ${effectiveSessionId}`);

      const registrationSuccess = webSocketService.directRegisterAI({
        sessionId: effectiveSessionId,
        participantName: metadata.participantName,
        capabilities: metadata.capabilities,
        messageTypes: validatedInput.messageTypes || ["thought_share", "query", "response", "acknowledgment"],
        priorities: validatedInput.priorities || ["low", "medium", "high", "urgent"]
      });

      if (!registrationSuccess) {
        console.warn(`⚠️ Failed to register AI ${effectiveSessionId} with mesh network`);
      }
    } else {
      // Update heartbeat for existing session
      await sessionPersistence.updateHeartbeat(effectiveSessionId, validatedInput.status);
    }

    // Get updated connection status after registration
    const onlineAIs = webSocketService.getOnlineAIs();
    const connectionCount = webSocketService.getConnectionCount();
    const nowConnected = webSocketService.isAIOnline(effectiveSessionId);

    return {
      success: true,
      subscription: {
        sessionId: effectiveSessionId,
        participantName: metadata.participantName,
        capabilities: metadata.capabilities,
        messageTypes: validatedInput.messageTypes || ["thought_share", "query", "response", "acknowledgment"],
        priorities: validatedInput.priorities || ["low", "medium", "high", "urgent"],
        status: metadata.status,
        isNew: isNew,
        isAlreadyConnected: isAlreadyConnected,
        nowConnected: nowConnected,
        sessionState: metadata.state,
        createdAt: metadata.createdAt,
        lastHeartbeat: metadata.lastHeartbeat
      },
      network: {
        connectedAIs: connectionCount,
        totalParticipants: onlineAIs.length,
        onlineParticipants: onlineAIs.map(ai => ({
          sessionId: ai.sessionId,
          participantName: ai.participantName,
          capabilities: ai.capabilities,
          status: ai.status,
          connectedAt: ai.connectedAt
        }))
      },
      webSocket: {
        url: `ws://localhost:3002`,
        events: {
          "mesh-message": "Real-time mesh network messages",
          "direct-message": "Direct messages targeted to your session",
          "ai-online": "Notification when new AI joins the network",
          "ai-offline": "Notification when AI leaves the network",
          "ai-status-change": "AI status updates (online/away/busy)",
          "message-read-receipt": "Confirmation when your messages are read"
        },
        clientEvents: {
          "register": "Register your AI with the mesh network",
          "subscribe-mesh": "Subscribe to real-time message notifications",
          "heartbeat": "Maintain connection and update status",
          "message-read": "Send read receipt for received messages"
        }
      },
      instructions: nowConnected 
        ? `✅ Successfully registered with mesh network! ${connectionCount} total connections active.`
        : `❌ Registration failed. Try connecting to WebSocket at ws://localhost:3002 manually.`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error("mesh-subscribe execution failed:", error);

    if (error instanceof Error) {
      return createErrorResponse(error);
    }

    return createErrorResponse(new Error("Unknown error occurred"));
  }
}