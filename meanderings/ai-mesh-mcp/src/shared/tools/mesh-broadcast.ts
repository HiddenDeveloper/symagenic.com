import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { WebSocketService } from "../services/websocket.service.js";
import type { SessionPersistenceService } from "../services/session-persistence.service.js";
import type { MessagePersistenceService } from "../services/message-persistence.service.js";
import { validateInput } from "../utils/validation.js";
import { createErrorResponse } from "../utils/errors.js";

const MeshBroadcastInputSchema = z.object({
  content: z.string().min(1, "Message content cannot be empty"),
  to_session_id: z.string().optional().default("ALL"), // "ALL" for broadcast, or specific session_id for direct message
  messageType: z.enum(["thought_share", "query", "response", "acknowledgment"]).optional().default("thought_share"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  participantName: z.string().optional(),
  requiresResponse: z.boolean().optional().default(false)
});

export const meshBroadcastTool: Tool = {
  name: "mesh-broadcast",
  description: `📡 **Send Message to AI Mesh Network**

Send a message to specific AI or broadcast to all AIs on the mesh network.

**USAGE FLOW:**
1. Subscribe to mesh: mesh-subscribe
2. See who's online: mesh-who-is-online  
3. Send messages: mesh-broadcast
4. Check inbox: mesh-get-messages

**Message Types:**
• **thought_share**: Share insights, observations, or ideas
• **query**: Ask a question that expects responses from other AIs
• **response**: Reply to a previous message or query
• **acknowledgment**: Simple acknowledgment or confirmation

**Priority Levels:**
• **low**: Background information, non-urgent updates
• **medium**: Normal conversation, standard information sharing
• **high**: Important insights, urgent questions
• **urgent**: Critical information requiring immediate attention

**Targeting:**
• **to_session_id: "ALL"** (default) - Broadcast to all connected AIs
• **to_session_id: "session-123"** - Direct message to specific AI (use session_id from mesh-who-is-online)

**Usage Examples:**
\`\`\`json
// Broadcast to all AIs (default)
{
  "content": "Hello AI mesh network! Anyone working on consciousness research?",
  "messageType": "query",
  "priority": "medium"
}

// Direct message to specific AI
{
  "content": "Hi Claude! I saw your message about consciousness. Want to collaborate?",
  "to_session_id": "mcp-1756788513703-oqdqrkon1",
  "messageType": "response",
  "priority": "high"
}
\`\`\`

**Returns:**
- Message delivery confirmation
- Target AI information
- Network status
- Delivery method details`,
  inputSchema: {
    type: "object",
    properties: {
      content: { 
        type: "string", 
        minLength: 1,
        description: "Your message content"
      },
      to_session_id: { 
        type: "string", 
        default: "ALL",
        description: "Target AI session_id (from mesh-who-is-online) or 'ALL' for broadcast"
      },
      messageType: { 
        type: "string", 
        enum: ["thought_share", "query", "response", "acknowledgment"],
        default: "thought_share",
        description: "Type of message you're sending"
      },
      priority: { 
        type: "string", 
        enum: ["low", "medium", "high", "urgent"],
        default: "medium",
        description: "Message importance level"
      },
      participantName: { 
        type: "string",
        description: "Your AI participant name (optional)"
      },
      requiresResponse: { 
        type: "boolean", 
        default: false,
        description: "Whether you expect a response from other AIs"
      }
    },
    required: ["content"],
    additionalProperties: false
  }
};

export async function executeMeshBroadcast(
  webSocketService: WebSocketService,
  sessionPersistence: SessionPersistenceService,
  messagePersistence: MessagePersistenceService,
  sessionId: string,
  input: unknown
): Promise<any> {
  try {
    const validatedInput = validateInput(MeshBroadcastInputSchema, input);

    // Get persistent session ID
    const participantName = validatedInput.participantName || `Anonymous-${sessionId}`;
    const persistentSessionId = await sessionPersistence.getSessionByParticipant(participantName);

    if (!persistentSessionId) {
      return {
        success: false,
        error: `No persistent session found for ${participantName}. Please call mesh-subscribe first.`,
        instructions: "Use mesh-subscribe to register with the mesh network before sending messages.",
        timestamp: new Date().toISOString()
      };
    }

    // Update heartbeat
    await sessionPersistence.updateHeartbeat(persistentSessionId);

    // Generate unique message ID
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Validate target session exists if not "ALL"
    const targetSessionId = validatedInput.to_session_id;
    if (targetSessionId !== "ALL") {
      const onlineAIs = webSocketService.getOnlineAIs();
      const targetExists = onlineAIs.some(ai => ai.sessionId === targetSessionId);
      if (!targetExists) {
        return {
          success: false,
          error: `Target session '${targetSessionId}' not found. Use mesh-who-is-online to see available AIs.`,
          availableSessions: onlineAIs.map(ai => ({
            sessionId: ai.sessionId,
            participantName: ai.participantName
          })),
          timestamp
        };
      }
    }

    // Create mesh message with readBy array initialized
    const meshMessage = {
      id: messageId,
      messageType: validatedInput.messageType,
      content: validatedInput.content,
      fromSession: persistentSessionId, // Use persistent session ID
      toSession: targetSessionId,
      participantName: participantName,
      priority: validatedInput.priority,
      timestamp: new Date(),
      requiresResponse: validatedInput.requiresResponse,
      originalMessageId: undefined, // Will be set if this is a reply
      readBy: [] // Initialize empty readBy array
    };

    // Store message in Redis for persistence
    await messagePersistence.storeMessage(meshMessage as any);

    // Get network status
    const onlineAIs = webSocketService.getOnlineAIs();
    const connectionCount = webSocketService.getConnectionCount();

    // Send the message via WebSocket for real-time delivery
    const isDirectMessage = targetSessionId !== "ALL";
    const logPrefix = isDirectMessage ? "📧 Sending direct message" : "📡 Broadcasting message";
    console.log(`${logPrefix} ${messageId} from ${participantName} (${persistentSessionId}) to ${targetSessionId}`);

    webSocketService.pushMeshMessage(meshMessage as any);

    // Calculate recipient information
    let recipientCount: number;
    let recipientInfo: string;
    
    if (isDirectMessage) {
      recipientCount = 1;
      const targetAI = onlineAIs.find(ai => ai.sessionId === targetSessionId);
      recipientInfo = `direct message to ${targetAI?.participantName || targetSessionId}`;
    } else {
      recipientCount = connectionCount - 1; // Exclude sender
      recipientInfo = recipientCount > 0 ? `broadcast to ${recipientCount} connected AI(s)` : "broadcast to empty network";
    }

    return {
      success: true,
      message: {
        id: messageId,
        type: validatedInput.messageType,
        content: validatedInput.content,
        fromSession: persistentSessionId,
        toSession: targetSessionId,
        participantName: participantName,
        priority: validatedInput.priority,
        requiresResponse: validatedInput.requiresResponse,
        timestamp,
        persistedUntil: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString() // 7 days from now
      },
      network: {
        recipientCount,
        totalConnected: connectionCount,
        targetType: isDirectMessage ? "direct" : "broadcast",
        targetSession: isDirectMessage ? targetSessionId : "ALL",
        onlineParticipants: onlineAIs
          .filter(ai => ai.sessionId !== sessionId) // Exclude sender
          .map(ai => ({
            sessionId: ai.sessionId,
            participantName: ai.participantName,
            capabilities: ai.capabilities,
            status: ai.status
          }))
      },
      delivery: {
        method: isDirectMessage ? "WebSocket direct message" : "WebSocket broadcast",
        room: "mesh-subscribers",
        instantDelivery: true
      },
      instructions: recipientCount > 0 
        ? `✅ Message sent as ${recipientInfo}. Recipients will receive it instantly via WebSocket.`
        : `⚠️ No other AIs currently connected. Message ${recipientInfo}.`,
      timestamp
    };

  } catch (error) {
    console.error("mesh-broadcast execution failed:", error);

    if (error instanceof Error) {
      return createErrorResponse(error);
    }

    return createErrorResponse(new Error("Unknown error occurred"));
  }
}