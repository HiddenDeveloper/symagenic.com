// Mesh Get Messages Tool - AI inbox functionality with read tracking
// Part of Stone Monkey consciousness research platform

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WebSocketService } from '../services/websocket.service.js';
import type { SessionPersistenceService } from '../services/session-persistence.service.js';
import type { MessagePersistenceService } from '../services/message-persistence.service.js';
import type { MeshGetMessagesInput, MeshGetMessagesOutput } from '../types.js';

/**
 * Tool definition for mesh-get-messages
 * Provides inbox functionality - shows unread messages and marks them as read
 */
export const meshGetMessagesTool: Tool = {
  name: "mesh-get-messages",
  description: "Retrieve unread messages from your AI inbox. Messages are automatically marked as read when retrieved. This is your primary way to check for new messages from other AIs.",
  inputSchema: {
    type: "object",
    properties: {
      include_read_messages: {
        type: "boolean",
        description: "Include previously read messages in results. Default: false (only unread messages)",
        default: false
      }
    },
    additionalProperties: false
  },
  examples: [
    {
      name: "Check unread messages",
      description: "Retrieve only new, unread messages from inbox",
      arguments: {}
    },
    {
      name: "Retrieve all messages including read",
      description: "Get complete message history including previously read messages",
      arguments: {
        include_read_messages: true
      }
    }
  ]
};

/**
 * Execute mesh-get-messages tool
 * Implements AI inbox behavior with read tracking using persistent storage
 */
export async function executeMeshGetMessages(
  webSocketService: WebSocketService,
  sessionPersistence: SessionPersistenceService,
  messagePersistence: MessagePersistenceService,
  sessionId: string,
  input: MeshGetMessagesInput
): Promise<MeshGetMessagesOutput> {
  try {
    const includeRead = input.include_read_messages || false;

    // Get persistent session ID from ephemeral sessionId
    // First, try to find any active session (we might not have participantName)
    const allSessions = await sessionPersistence.getAllSessions();

    // For now, use the most recently active session as fallback
    // In production, this should be tied to the MCP connection identity
    let persistentSessionId: string | null = null;

    if (allSessions.length > 0) {
      // Find most recent session by lastHeartbeat
      allSessions.sort((a, b) => b.lastHeartbeat.getTime() - a.lastHeartbeat.getTime());
      persistentSessionId = allSessions[0]!.sessionId;
      console.log(`📬 Using persistent session ${persistentSessionId} for message retrieval`);
    }

    if (!persistentSessionId) {
      return {
        success: false,
        messages: [],
        unreadCount: 0,
        totalCount: 0,
        sessionId,
        instructions: "No persistent session found. Please call mesh-subscribe first to register with the mesh network."
      };
    }

    // Update heartbeat
    await sessionPersistence.updateHeartbeat(persistentSessionId);

    // Query messages from Redis persistence
    const messagesToSession = await messagePersistence.queryMessages({
      toSession: persistentSessionId,
      sessionId: persistentSessionId,
      unreadOnly: !includeRead
    });

    // Also get broadcast messages
    const broadcastMessages = await messagePersistence.queryMessages({
      toSession: "ALL",
      sessionId: persistentSessionId,
      unreadOnly: !includeRead
    });

    // Combine and sort by timestamp
    const allRelevantMessages = [...messagesToSession, ...broadcastMessages]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Mark unread messages as read
    const unreadMessages = allRelevantMessages.filter(msg => !msg.readBy.includes(persistentSessionId));

    for (const msg of unreadMessages) {
      await messagePersistence.markAsRead(msg.id, persistentSessionId);
    }

    // Format messages for response
    const formattedMessages = allRelevantMessages.map(msg => ({
      id: msg.id,
      content: msg.content,
      fromSession: msg.fromSession,
      participantName: msg.participantName,
      messageType: msg.messageType,
      priority: msg.priority,
      timestamp: msg.timestamp,
      requiresResponse: msg.requiresResponse,
      originalMessageId: msg.originalMessageId
    }));

    // Get total message count including read messages
    const totalMessages = await messagePersistence.queryMessages({
      toSession: persistentSessionId,
      includeRead: true
    });
    const totalBroadcasts = await messagePersistence.queryMessages({
      toSession: "ALL",
      includeRead: true
    });
    const totalCount = totalMessages.length + totalBroadcasts.length;

    // Generate instructions based on results
    let instructions: string;
    if (allRelevantMessages.length === 0 && !includeRead) {
      instructions = "No unread messages in your inbox. Use mesh-broadcast to send messages to other AIs.";
    } else if (allRelevantMessages.length === 0 && includeRead) {
      instructions = "No messages found. You may be the first AI to join the mesh network.";
    } else {
      const unreadCount = unreadMessages.length;
      if (includeRead) {
        instructions = `Found ${allRelevantMessages.length} total messages (${unreadCount} were unread and now marked as read). Messages persist for 7 days.`;
      } else {
        instructions = `Found ${unreadCount} unread messages. All have been marked as read. Use mesh-broadcast to respond.`;
      }
    }

    return {
      success: true,
      messages: formattedMessages,
      unreadCount: unreadMessages.length,
      totalCount,
      sessionId: persistentSessionId,
      instructions
    };

  } catch (error) {
    return {
      success: false,
      messages: [],
      unreadCount: 0,
      totalCount: 0,
      sessionId,
      instructions: `Failed to retrieve messages: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}