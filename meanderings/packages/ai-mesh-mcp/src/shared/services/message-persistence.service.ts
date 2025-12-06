/**
 * Message Persistence Service
 *
 * Provides durable Redis-based message storage for AI mesh communication.
 * Replaces in-memory message history with persistent storage.
 *
 * Features:
 * - 7-day message retention (configurable)
 * - No message count limits (vs 50-message in-memory limit)
 * - Proper read tracking with persistent sessions
 * - Message threading support for conversation coherence
 * - Query by session, time range, message type
 */

import { createClient, RedisClientType } from 'redis';
import type { RedisNetworkMessage } from '../types.js';

export interface MessagePersistenceConfig {
  redisUrl: string;
  messageTTL: number; // seconds, default 7 days
}

export interface MessageQuery {
  sessionId?: string; // Get messages to/from specific session
  toSession?: string; // Get messages directed to specific session
  fromSession?: string; // Get messages from specific session
  messageType?: string; // Filter by message type
  priority?: string; // Filter by priority
  unreadOnly?: boolean; // Only unread messages for given sessionId
  includeRead?: boolean; // Include read messages
  limit?: number; // Max messages to return
  since?: Date; // Messages since timestamp
  until?: Date; // Messages until timestamp
  threadId?: string; // Get messages in specific thread
}

export interface MessageThread {
  rootMessageId: string;
  replyCount: number;
  participants: string[];
  lastActivity: Date;
  messages: RedisNetworkMessage[];
}

export class MessagePersistenceService {
  private client: RedisClientType;
  private config: MessagePersistenceConfig;
  private isConnected = false;

  constructor(config: MessagePersistenceConfig) {
    this.config = config;
    this.client = createClient({
      url: config.redisUrl,
      socket: {
        keepAlive: true, // Enable TCP keepalive
        noDelay: true, // Disable Nagle's algorithm for lower latency
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('MessagePersistence Redis: Max reconnection retries reached');
            return new Error('Max retries exceeded');
          }
          const delay = Math.min(retries * 100, 3000);
          console.log(`MessagePersistence Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        }
      }
    }) as RedisClientType;

    this.client.on('error', (err: Error) => {
      // Only log non-socket-close errors to reduce noise
      if (!err.message.includes('Socket closed unexpectedly')) {
        console.error('MessagePersistence Redis Error:', err);
      }
    });

    this.client.on('connect', () => {
      console.log('✅ MessagePersistence Redis connected');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 MessagePersistence Redis reconnecting...');
      this.isConnected = false;
    });

    this.client.on('ready', () => {
      console.log('✅ MessagePersistence Redis ready');
      this.isConnected = true;
    });
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  /**
   * Store a message in Redis
   */
  async storeMessage(message: RedisNetworkMessage): Promise<void> {
    const messageKey = `mesh:message:${message.id}`;

    // Serialize message
    const serialized = JSON.stringify({
      ...message,
      timestamp: message.timestamp.toISOString()
    });

    // Store message data with TTL
    await this.client.set(messageKey, serialized, { EX: this.config.messageTTL });

    // Add to global message index (sorted by timestamp)
    const score = message.timestamp.getTime();
    await this.client.zAdd('mesh:messages:all', { score, value: message.id });

    // Index by toSession
    await this.client.zAdd(`mesh:messages:to:${message.toSession}`, { score, value: message.id });

    // Index by fromSession
    await this.client.zAdd(`mesh:messages:from:${message.fromSession}`, { score, value: message.id });

    // Index by message type
    await this.client.zAdd(`mesh:messages:type:${message.messageType}`, { score, value: message.id });

    // Index by priority
    await this.client.zAdd(`mesh:messages:priority:${message.priority}`, { score, value: message.id });

    // If this is a reply, add to thread
    if (message.originalMessageId) {
      await this.addToThread(message.originalMessageId, message.id);
    }

    console.log(`📨 Message stored: ${message.id} (${message.messageType}, ${message.priority})`);
  }

  /**
   * Retrieve a specific message by ID
   */
  async getMessage(messageId: string): Promise<RedisNetworkMessage | null> {
    const data = await this.client.get(`mesh:message:${messageId}`);

    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);

    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp)
    };
  }

  /**
   * Query messages with flexible filters
   */
  async queryMessages(query: MessageQuery): Promise<RedisNetworkMessage[]> {
    let messageIds: string[] = [];

    // Determine which index to use
    if (query.toSession) {
      messageIds = await this.getMessageIdsFromIndex(`mesh:messages:to:${query.toSession}`, query);
    } else if (query.fromSession) {
      messageIds = await this.getMessageIdsFromIndex(`mesh:messages:from:${query.fromSession}`, query);
    } else if (query.messageType) {
      messageIds = await this.getMessageIdsFromIndex(`mesh:messages:type:${query.messageType}`, query);
    } else if (query.priority) {
      messageIds = await this.getMessageIdsFromIndex(`mesh:messages:priority:${query.priority}`, query);
    } else {
      // Use global index
      messageIds = await this.getMessageIdsFromIndex('mesh:messages:all', query);
    }

    // Retrieve actual messages
    const messages: RedisNetworkMessage[] = [];

    for (const messageId of messageIds) {
      const message = await this.getMessage(messageId);

      if (!message) {
        continue;
      }

      // Assert that message is not undefined after the check
      const msg = message as RedisNetworkMessage;

      // Apply additional filters
      if (query.sessionId && query.unreadOnly) {
        // Check if message is unread by sessionId
        if (msg.readBy.includes(query.sessionId)) {
          continue; // Skip read messages
        }
      }

      if (query.messageType && msg.messageType !== query.messageType) {
        continue;
      }

      if (query.priority && msg.priority !== query.priority) {
        continue;
      }

      messages.push(msg);
    }

    // Apply limit
    if (query.limit && messages.length > query.limit) {
      return messages.slice(0, query.limit);
    }

    return messages;
  }

  /**
   * Mark message as read by a session
   */
  async markAsRead(messageId: string, sessionId: string): Promise<void> {
    const message = await this.getMessage(messageId);

    if (!message) {
      console.warn(`Cannot mark non-existent message as read: ${messageId}`);
      return;
    }

    if (message.readBy.includes(sessionId)) {
      // Already read
      return;
    }

    // Add to readBy array
    message.readBy.push(sessionId);

    // Update message
    await this.client.set(
      `mesh:message:${messageId}`,
      JSON.stringify({
        ...message,
        timestamp: message.timestamp.toISOString()
      }),
      { EX: this.config.messageTTL }
    );

    console.log(`✅ Message ${messageId} marked as read by ${sessionId}`);
  }

  /**
   * Get unread message count for a session
   */
  async getUnreadCount(sessionId: string): Promise<number> {
    const messages = await this.queryMessages({
      toSession: sessionId,
      unreadOnly: true
    });

    // Also include broadcast messages
    const broadcastMessages = await this.queryMessages({
      toSession: 'ALL',
      sessionId,
      unreadOnly: true
    });

    return messages.length + broadcastMessages.length;
  }

  /**
   * Add message to thread
   */
  private async addToThread(rootMessageId: string, replyMessageId: string): Promise<void> {
    const threadKey = `mesh:thread:${rootMessageId}`;

    // Add reply to thread set (sorted by timestamp)
    const replyMessage = await this.getMessage(replyMessageId);

    if (replyMessage) {
      const score = replyMessage.timestamp.getTime();
      await this.client.zAdd(threadKey, { score, value: replyMessageId });

      // Set TTL on thread
      await this.client.expire(threadKey, this.config.messageTTL);

      console.log(`🧵 Added message ${replyMessageId} to thread ${rootMessageId}`);
    }
  }

  /**
   * Get message thread (root message + all replies)
   */
  async getThread(rootMessageId: string): Promise<MessageThread | null> {
    const rootMessage = await this.getMessage(rootMessageId);

    if (!rootMessage) {
      return null;
    }

    // Get all replies
    const replyIds = await this.client.zRange(`mesh:thread:${rootMessageId}`, 0, -1);
    const replies: RedisNetworkMessage[] = [];

    for (const replyId of replyIds) {
      const reply = await this.getMessage(replyId);
      if (reply) {
        replies.push(reply);
      }
    }

    // Get unique participants
    const participants = new Set<string>();
    participants.add(rootMessage.fromSession);
    replies.forEach(reply => participants.add(reply.fromSession));

    // Get last activity
    const lastActivity = replies.length > 0
      ? replies[replies.length - 1]!.timestamp
      : rootMessage.timestamp;

    return {
      rootMessageId,
      replyCount: replies.length,
      participants: Array.from(participants),
      lastActivity,
      messages: [rootMessage, ...replies]
    };
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const message = await this.getMessage(messageId);

    if (!message) {
      return;
    }

    // Remove from all indices
    await this.client.zRem('mesh:messages:all', messageId);
    await this.client.zRem(`mesh:messages:to:${message.toSession}`, messageId);
    await this.client.zRem(`mesh:messages:from:${message.fromSession}`, messageId);
    await this.client.zRem(`mesh:messages:type:${message.messageType}`, messageId);
    await this.client.zRem(`mesh:messages:priority:${message.priority}`, messageId);

    // Delete message data
    await this.client.del(`mesh:message:${messageId}`);

    // Delete thread if this was a root message
    await this.client.del(`mesh:thread:${messageId}`);

    console.log(`🗑️ Message deleted: ${messageId}`);
  }

  /**
   * Cleanup old messages (called periodically)
   */
  async cleanupExpiredMessages(): Promise<number> {
    // Redis TTL handles automatic expiration, but we clean up indices
    const allMessageIds = await this.client.zRange('mesh:messages:all', 0, -1);
    let cleanedCount = 0;

    for (const messageId of allMessageIds) {
      const exists = await this.client.exists(`mesh:message:${messageId}`);

      if (!exists) {
        // Message expired, remove from indices
        await this.client.zRem('mesh:messages:all', messageId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired messages from indices`);
    }

    return cleanedCount;
  }

  /**
   * Get message IDs from sorted set index with time range
   */
  private async getMessageIdsFromIndex(indexKey: string, query: MessageQuery): Promise<string[]> {
    const minScore = query.since ? query.since.getTime() : '-inf';
    const maxScore = query.until ? query.until.getTime() : '+inf';

    return await this.client.zRangeByScore(indexKey, minScore, maxScore);
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('🔌 MessagePersistence Redis disconnected');
    }
  }
}
