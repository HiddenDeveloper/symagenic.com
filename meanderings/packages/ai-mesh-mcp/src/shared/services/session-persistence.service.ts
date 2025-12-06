/**
 * Session Persistence Service
 *
 * Manages stable AI session identities across MCP tool invocations using Redis.
 * Solves the ephemeral session ID problem by mapping participantName → stable sessionId.
 *
 * Features:
 * - 7-day session TTL (configurable)
 * - Collision detection for duplicate participantNames
 * - Heartbeat tracking (active/dormant/archived states)
 * - Capability and status management
 */

import { createClient, RedisClientType } from 'redis';

export interface SessionMetadata {
  sessionId: string;
  participantName: string;
  capabilities: string[];
  status: 'online' | 'away' | 'busy';
  createdAt: Date;
  lastHeartbeat: Date;
  messageTypes: string[];
  priorities: string[];
  state: 'active' | 'dormant' | 'archived';
}

export interface SessionPersistenceConfig {
  redisUrl: string;
  sessionTTL: number; // seconds, default 7 days
  heartbeatTimeout: number; // seconds, default 30 minutes
}

export class SessionPersistenceService {
  private client: RedisClientType;
  private config: SessionPersistenceConfig;
  private isConnected = false;

  constructor(config: SessionPersistenceConfig) {
    this.config = config;
    this.client = createClient({
      url: config.redisUrl,
      socket: {
        keepAlive: true, // Enable TCP keepalive
        noDelay: true, // Disable Nagle's algorithm for lower latency
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('SessionPersistence Redis: Max reconnection retries reached');
            return new Error('Max retries exceeded');
          }
          const delay = Math.min(retries * 100, 3000);
          console.log(`SessionPersistence Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        }
      }
    }) as RedisClientType;

    this.client.on('error', (err: Error) => {
      // Only log non-socket-close errors to reduce noise
      if (!err.message.includes('Socket closed unexpectedly')) {
        console.error('SessionPersistence Redis Error:', err);
      }
    });

    this.client.on('connect', () => {
      console.log('✅ SessionPersistence Redis connected');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 SessionPersistence Redis reconnecting...');
      this.isConnected = false;
    });

    this.client.on('ready', () => {
      console.log('✅ SessionPersistence Redis ready');
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
   * Get or create a stable session for a participant
   * Returns existing session if participantName exists, creates new one otherwise
   */
  async getOrCreateSession(registration: {
    participantName: string;
    capabilities?: string[];
    status?: 'online' | 'away' | 'busy';
    messageTypes?: string[];
    priorities?: string[];
  }): Promise<{ sessionId: string; isNew: boolean; metadata: SessionMetadata }> {
    const { participantName, capabilities = [], status = 'online', messageTypes = [], priorities = [] } = registration;

    // Check if session already exists
    const existingSessionId = await this.client.get(`mesh:participant:${participantName}`);

    if (existingSessionId) {
      // Session exists - retrieve and update heartbeat
      const metadata = await this.getSessionMetadata(existingSessionId);

      if (metadata) {
        // Update heartbeat and status
        await this.updateHeartbeat(existingSessionId, status);

        return {
          sessionId: existingSessionId,
          isNew: false,
          metadata: {
            ...metadata,
            status,
            lastHeartbeat: new Date(),
            state: 'active'
          }
        };
      }
    }

    // Create new session
    const sessionId = `session-${Date.now()}-${this.generateId()}`;
    const now = new Date();

    const metadata: SessionMetadata = {
      sessionId,
      participantName,
      capabilities,
      status,
      createdAt: now,
      lastHeartbeat: now,
      messageTypes,
      priorities,
      state: 'active'
    };

    // Store session metadata
    await this.client.set(
      `mesh:session:${sessionId}`,
      JSON.stringify(metadata),
      { EX: this.config.sessionTTL }
    );

    // Create participantName → sessionId mapping
    await this.client.set(
      `mesh:participant:${participantName}`,
      sessionId,
      { EX: this.config.sessionTTL }
    );

    // Add to active sessions set
    await this.client.sAdd('mesh:sessions:active', sessionId);

    console.log(`🆕 Created new persistent session: ${participantName} → ${sessionId}`);

    return {
      sessionId,
      isNew: true,
      metadata
    };
  }

  /**
   * Get session metadata by sessionId
   */
  async getSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    const data = await this.client.get(`mesh:session:${sessionId}`);

    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);

    // Convert date strings back to Date objects
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      lastHeartbeat: new Date(parsed.lastHeartbeat)
    };
  }

  /**
   * Get session ID by participant name
   */
  async getSessionByParticipant(participantName: string): Promise<string | null> {
    return await this.client.get(`mesh:participant:${participantName}`);
  }

  /**
   * Update session heartbeat and status
   */
  async updateHeartbeat(sessionId: string, status?: 'online' | 'away' | 'busy'): Promise<void> {
    const metadata = await this.getSessionMetadata(sessionId);

    if (!metadata) {
      console.warn(`Cannot update heartbeat for non-existent session: ${sessionId}`);
      return;
    }

    const now = new Date();
    const updatedMetadata: SessionMetadata = {
      ...metadata,
      lastHeartbeat: now,
      status: status || metadata.status,
      state: 'active'
    };

    // Update session metadata
    await this.client.set(
      `mesh:session:${sessionId}`,
      JSON.stringify(updatedMetadata),
      { EX: this.config.sessionTTL }
    );

    // Refresh participantName mapping TTL
    await this.client.expire(`mesh:participant:${metadata.participantName}`, this.config.sessionTTL);

    console.log(`💓 Heartbeat updated for ${metadata.participantName} (${sessionId})`);
  }

  /**
   * Check for dormant sessions (no heartbeat within timeout)
   */
  async markDormantSessions(): Promise<string[]> {
    const activeSessions = await this.client.sMembers('mesh:sessions:active');
    const dormantSessions: string[] = [];
    const now = Date.now();
    const dormantThreshold = this.config.heartbeatTimeout * 1000; // convert to ms

    for (const sessionId of activeSessions) {
      const metadata = await this.getSessionMetadata(sessionId);

      if (!metadata) {
        // Session expired, remove from active set
        await this.client.sRem('mesh:sessions:active', sessionId);
        continue;
      }

      const timeSinceHeartbeat = now - metadata.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > dormantThreshold && metadata.state !== 'dormant') {
        // Mark as dormant
        const updatedMetadata: SessionMetadata = {
          ...metadata,
          state: 'dormant'
        };

        await this.client.set(
          `mesh:session:${sessionId}`,
          JSON.stringify(updatedMetadata),
          { EX: this.config.sessionTTL }
        );

        dormantSessions.push(sessionId);
        console.log(`😴 Session marked dormant: ${metadata.participantName} (${sessionId})`);
      }
    }

    return dormantSessions;
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<SessionMetadata[]> {
    const sessionIds = await this.client.sMembers('mesh:sessions:active');
    const sessions: SessionMetadata[] = [];

    for (const sessionId of sessionIds) {
      const metadata = await this.getSessionMetadata(sessionId);
      if (metadata && metadata.state === 'active') {
        sessions.push(metadata);
      }
    }

    return sessions;
  }

  /**
   * Get all sessions (active + dormant)
   */
  async getAllSessions(): Promise<SessionMetadata[]> {
    const sessionIds = await this.client.sMembers('mesh:sessions:active');
    const sessions: SessionMetadata[] = [];

    for (const sessionId of sessionIds) {
      const metadata = await this.getSessionMetadata(sessionId);
      if (metadata) {
        sessions.push(metadata);
      }
    }

    return sessions;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const metadata = await this.getSessionMetadata(sessionId);

    if (!metadata) {
      return;
    }

    // Remove session data
    await this.client.del(`mesh:session:${sessionId}`);

    // Remove participantName mapping
    await this.client.del(`mesh:participant:${metadata.participantName}`);

    // Remove from active sessions set
    await this.client.sRem('mesh:sessions:active', sessionId);

    console.log(`🗑️ Session deleted: ${metadata.participantName} (${sessionId})`);
  }

  /**
   * Check for participantName collision
   * Returns true if participantName exists with different metadata
   */
  async checkCollision(participantName: string, expectedCapabilities?: string[]): Promise<{
    hasCollision: boolean;
    existingSession?: SessionMetadata;
  }> {
    const existingSessionId = await this.getSessionByParticipant(participantName);

    if (!existingSessionId) {
      return { hasCollision: false };
    }

    const existingMetadata = await this.getSessionMetadata(existingSessionId);

    if (!existingMetadata) {
      return { hasCollision: false };
    }

    // Check if capabilities differ significantly
    if (expectedCapabilities && expectedCapabilities.length > 0) {
      const capabilitiesMatch = expectedCapabilities.every(cap =>
        existingMetadata.capabilities.includes(cap)
      );

      if (!capabilitiesMatch) {
        return {
          hasCollision: true,
          existingSession: existingMetadata
        };
      }
    }

    return {
      hasCollision: false,
      existingSession: existingMetadata
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('🔌 SessionPersistence Redis disconnected');
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
