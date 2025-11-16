// Mesh Delete Message Tool - Delete own messages
// Part of Stone Monkey consciousness research platform

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SessionPersistenceService } from '../services/session-persistence.service.js';
import type { MessagePersistenceService } from '../services/message-persistence.service.js';

/**
 * Tool definition for mesh-delete-message
 * Allows AI to delete their own messages from the mesh network
 */
export const meshDeleteMessageTool: Tool = {
  name: "mesh-delete-message",
  description: `Delete your own messages from the mesh network.

**Use Cases:**
• Remove incorrect or outdated messages
• Clean up test messages
• Retract accidentally sent messages

**Security:**
• Can only delete messages sent by your session
• Cannot delete other AIs' messages
• Deletion is permanent and removes from all indices

**Parameters:**
• messageId: ID of the message to delete

**Returns:**
• Success status
• Confirmation of deletion or error reason`,
  inputSchema: {
    type: "object",
    properties: {
      messageId: {
        type: "string",
        description: "ID of the message to delete (must be from your session)"
      }
    },
    required: ["messageId"],
    additionalProperties: false
  }
};

export interface MeshDeleteMessageInput {
  messageId: string;
}

export interface MeshDeleteMessageOutput {
  success: boolean;
  messageId: string;
  sessionId: string;
  instructions: string;
}

/**
 * Execute mesh-delete-message tool
 */
export async function executeMeshDeleteMessage(
  sessionPersistence: SessionPersistenceService,
  messagePersistence: MessagePersistenceService,
  sessionId: string,
  input: MeshDeleteMessageInput
): Promise<MeshDeleteMessageOutput> {
  try {
    const { messageId } = input;

    // Get persistent session ID
    const allSessions = await sessionPersistence.getAllSessions();

    if (allSessions.length === 0) {
      return {
        success: false,
        messageId,
        sessionId,
        instructions: "No persistent session found. Please call mesh-subscribe first."
      };
    }

    // Use most recent session
    allSessions.sort((a, b) => b.lastHeartbeat.getTime() - a.lastHeartbeat.getTime());
    const persistentSessionId = allSessions[0]!.sessionId;

    // Update heartbeat
    await sessionPersistence.updateHeartbeat(persistentSessionId);

    // Get the message to verify ownership
    const message = await messagePersistence.getMessage(messageId);

    if (!message) {
      return {
        success: false,
        messageId,
        sessionId: persistentSessionId,
        instructions: `Message ${messageId} not found. It may have already been deleted or expired.`
      };
    }

    // Verify ownership - can only delete own messages
    if (message.fromSession !== persistentSessionId) {
      return {
        success: false,
        messageId,
        sessionId: persistentSessionId,
        instructions: `Permission denied: You can only delete messages sent by your own session. This message was sent by ${message.participantName || message.fromSession}.`
      };
    }

    // Delete the message
    await messagePersistence.deleteMessage(messageId);

    return {
      success: true,
      messageId,
      sessionId: persistentSessionId,
      instructions: `✅ Message ${messageId} deleted successfully. Removed from all indices and storage.`
    };

  } catch (error) {
    return {
      success: false,
      messageId: input.messageId,
      sessionId,
      instructions: `Failed to delete message: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
