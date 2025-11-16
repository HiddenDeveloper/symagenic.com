// Mesh Mark Read Tool - Explicit read marking without retrieval
// Part of Stone Monkey consciousness research platform

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SessionPersistenceService } from '../services/session-persistence.service.js';
import type { MessagePersistenceService } from '../services/message-persistence.service.js';

/**
 * Tool definition for mesh-mark-read
 * Allows AI to mark messages as read without retrieving them
 */
export const meshMarkReadTool: Tool = {
  name: "mesh-mark-read",
  description: `Mark specific messages as read without retrieving their content.

**Use Cases:**
• Mark all messages from a specific sender as read
• Mark messages by ID after processing them elsewhere
• Bulk mark operations for inbox management

**Parameters:**
• messageIds: Array of message IDs to mark as read
• markAll: Mark all unread messages as read (boolean)

**Returns:**
• Number of messages marked as read
• Updated unread count`,
  inputSchema: {
    type: "object",
    properties: {
      messageIds: {
        type: "array",
        items: { type: "string" },
        description: "Array of message IDs to mark as read"
      },
      markAll: {
        type: "boolean",
        description: "Mark all unread messages as read",
        default: false
      }
    },
    additionalProperties: false
  }
};

export interface MeshMarkReadInput {
  messageIds?: string[];
  markAll?: boolean;
}

export interface MeshMarkReadOutput {
  success: boolean;
  markedCount: number;
  remainingUnread: number;
  sessionId: string;
  instructions: string;
}

/**
 * Execute mesh-mark-read tool
 */
export async function executeMeshMarkRead(
  sessionPersistence: SessionPersistenceService,
  messagePersistence: MessagePersistenceService,
  sessionId: string,
  input: MeshMarkReadInput
): Promise<MeshMarkReadOutput> {
  try {
    const { messageIds = [], markAll = false } = input;

    // Get persistent session ID
    const allSessions = await sessionPersistence.getAllSessions();

    if (allSessions.length === 0) {
      return {
        success: false,
        markedCount: 0,
        remainingUnread: 0,
        sessionId,
        instructions: "No persistent session found. Please call mesh-subscribe first."
      };
    }

    // Use most recent session
    allSessions.sort((a, b) => b.lastHeartbeat.getTime() - a.lastHeartbeat.getTime());
    const persistentSessionId = allSessions[0]!.sessionId;

    // Update heartbeat
    await sessionPersistence.updateHeartbeat(persistentSessionId);

    let markedCount = 0;

    if (markAll) {
      // Get all unread messages
      const unreadDirect = await messagePersistence.queryMessages({
        toSession: persistentSessionId,
        sessionId: persistentSessionId,
        unreadOnly: true
      });

      const unreadBroadcast = await messagePersistence.queryMessages({
        toSession: "ALL",
        sessionId: persistentSessionId,
        unreadOnly: true
      });

      const allUnread = [...unreadDirect, ...unreadBroadcast];

      // Mark all as read
      for (const msg of allUnread) {
        await messagePersistence.markAsRead(msg.id, persistentSessionId);
        markedCount++;
      }
    } else if (messageIds.length > 0) {
      // Mark specific messages as read
      for (const msgId of messageIds) {
        const message = await messagePersistence.getMessage(msgId);

        if (message && !message.readBy.includes(persistentSessionId)) {
          await messagePersistence.markAsRead(msgId, persistentSessionId);
          markedCount++;
        }
      }
    } else {
      return {
        success: false,
        markedCount: 0,
        remainingUnread: 0,
        sessionId: persistentSessionId,
        instructions: "Please provide either messageIds array or set markAll to true."
      };
    }

    // Get updated unread count
    const remainingUnread = await messagePersistence.getUnreadCount(persistentSessionId);

    return {
      success: true,
      markedCount,
      remainingUnread,
      sessionId: persistentSessionId,
      instructions: `Marked ${markedCount} message(s) as read. ${remainingUnread} unread message(s) remaining.`
    };

  } catch (error) {
    return {
      success: false,
      markedCount: 0,
      remainingUnread: 0,
      sessionId,
      instructions: `Failed to mark messages as read: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
