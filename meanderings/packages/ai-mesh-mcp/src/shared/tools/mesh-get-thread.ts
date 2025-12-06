// Mesh Get Thread Tool - Retrieve conversation threads
// Part of Stone Monkey consciousness research platform

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { SessionPersistenceService } from '../services/session-persistence.service.js';
import type { MessagePersistenceService } from '../services/message-persistence.service.js';
import type { RedisNetworkMessage } from '../types.js';

/**
 * Tool definition for mesh-get-thread
 * Retrieve entire conversation thread by root message ID
 */
export const meshGetThreadTool: Tool = {
  name: "mesh-get-thread",
  description: `Retrieve an entire conversation thread including root message and all replies.

**Use Cases:**
• View full context of a conversation
• Analyze discussion flow and participants
• Review threaded discussions chronologically

**Parameters:**
• rootMessageId: ID of the original message that started the thread

**Returns:**
• Root message
• All replies in chronological order
• Participant list
• Reply count
• Last activity timestamp`,
  inputSchema: {
    type: "object",
    properties: {
      rootMessageId: {
        type: "string",
        description: "ID of the root message to retrieve thread for"
      }
    },
    required: ["rootMessageId"],
    additionalProperties: false
  },
  examples: [
    {
      name: "Retrieve conversation thread",
      description: "Get entire conversation thread including all replies",
      arguments: {
        rootMessageId: "msg-root-123"
      }
    }
  ]
};

export interface MeshGetThreadInput {
  rootMessageId: string;
}

export interface MeshGetThreadOutput {
  success: boolean;
  thread?: {
    rootMessageId: string;
    replyCount: number;
    participants: string[];
    lastActivity: Date;
    messages: Array<{
      id: string;
      content: string;
      fromSession: string;
      participantName?: string;
      messageType: string;
      priority: string;
      timestamp: Date;
      requiresResponse?: boolean;
      isRootMessage: boolean;
    }>;
  };
  sessionId: string;
  instructions: string;
}

/**
 * Execute mesh-get-thread tool
 */
export async function executeMeshGetThread(
  sessionPersistence: SessionPersistenceService,
  messagePersistence: MessagePersistenceService,
  sessionId: string,
  input: MeshGetThreadInput
): Promise<MeshGetThreadOutput> {
  try {
    const { rootMessageId } = input;

    // Get persistent session ID
    const allSessions = await sessionPersistence.getAllSessions();

    if (allSessions.length === 0) {
      return {
        success: false,
        sessionId,
        instructions: "No persistent session found. Please call mesh-subscribe first."
      };
    }

    // Use most recent session
    allSessions.sort((a, b) => b.lastHeartbeat.getTime() - a.lastHeartbeat.getTime());
    const persistentSessionId = allSessions[0]!.sessionId;

    // Update heartbeat
    await sessionPersistence.updateHeartbeat(persistentSessionId);

    // Get thread from message persistence service
    const thread = await messagePersistence.getThread(rootMessageId);

    if (!thread) {
      return {
        success: false,
        sessionId: persistentSessionId,
        instructions: `Thread not found for message ID: ${rootMessageId}. The message may have expired or doesn't exist.`
      };
    }

    // Format messages with isRootMessage flag
    const formattedMessages = thread.messages.map((msg, index) => ({
      id: msg.id,
      content: msg.content,
      fromSession: msg.fromSession,
      participantName: msg.participantName,
      messageType: msg.messageType,
      priority: msg.priority,
      timestamp: msg.timestamp,
      requiresResponse: msg.requiresResponse,
      isRootMessage: index === 0
    }));

    return {
      success: true,
      thread: {
        rootMessageId: thread.rootMessageId,
        replyCount: thread.replyCount,
        participants: thread.participants,
        lastActivity: thread.lastActivity,
        messages: formattedMessages
      },
      sessionId: persistentSessionId,
      instructions: `Retrieved thread with ${thread.replyCount} reply/replies from ${thread.participants.length} participant(s). Last activity: ${thread.lastActivity.toISOString()}`
    };

  } catch (error) {
    return {
      success: false,
      sessionId,
      instructions: `Failed to retrieve thread: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
