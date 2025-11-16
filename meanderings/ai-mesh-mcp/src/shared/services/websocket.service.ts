/**
 * WebSocket service for real-time AI-to-AI mesh communication
 * Provides push notifications and presence management
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import type { RedisNetworkMessage } from '../types.js';
import { EventEmitter } from 'node:events';

export interface AIPresence {
  sessionId: string;
  participantName?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  capabilities: string[];
  status: 'online' | 'away' | 'busy';
}

export interface WebSocketConnection {
  socketId: string;
  sessionId: string;
  participantName?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  socket: any; // Socket.IO socket instance
}

export class WebSocketService extends EventEmitter {
  private io: SocketIOServer;
  private connections = new Map<string, WebSocketConnection>(); // socketId -> connection
  private sessionToSocket = new Map<string, string>(); // sessionId -> socketId
  private presenceRegistry = new Map<string, AIPresence>(); // sessionId -> presence
  private heartbeatInterval?: NodeJS.Timeout;
  // NOTE: Message history removed - messages now persist in MessagePersistenceService (Redis)
  // private messageHistory: RedisNetworkMessage[] = [];
  // private readonly MAX_MESSAGE_HISTORY = 50;

  constructor(httpServer: HttpServer) {
    super();
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    this.startHeartbeatCheck();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 WebSocket connection established: ${socket.id}`);
      
      // Handle AI registration
      socket.on('register', (data: {
        sessionId: string;
        participantName?: string;
        capabilities?: string[];
      }) => {
        this.handleRegistration(socket, data);
      });

      // Handle mesh subscription (AI wants to receive real-time messages)
      socket.on('subscribe-mesh', (data: {
        sessionId: string;
        messageTypes?: string[];
        priorities?: string[];
      }) => {
        this.handleMeshSubscription(socket, data);
      });

      // Handle heartbeat from AI instances
      socket.on('heartbeat', (data: {
        sessionId: string;
        status?: 'online' | 'away' | 'busy';
      }) => {
        this.handleHeartbeat(socket, data);
      });

      // Handle presence queries
      socket.on('get-presence', (callback) => {
        callback({
          success: true,
          presence: Array.from(this.presenceRegistry.values())
        });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`🔌 WebSocket disconnected: ${socket.id}, reason: ${reason}`);
        this.handleDisconnection(socket);
      });

      // Handle message read receipts
      socket.on('message-read', (data: {
        messageId: string;
        sessionId: string;
      }) => {
        this.handleMessageRead(data);
      });
    });
  }

  private handleRegistration(socket: any, data: {
    sessionId: string;
    participantName?: string;
    capabilities?: string[];
  }): void {
    const { sessionId, participantName, capabilities = [] } = data;
    
    // Create connection record
    const connection: WebSocketConnection = {
      socketId: socket.id,
      sessionId,
      participantName,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      socket
    };

    // Store connection mappings
    this.connections.set(socket.id, connection);
    this.sessionToSocket.set(sessionId, socket.id);

    // Create presence record
    const presence: AIPresence = {
      sessionId,
      participantName,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      capabilities,
      status: 'online'
    };

    this.presenceRegistry.set(sessionId, presence);

    console.log(`🤖 AI registered: ${participantName || sessionId} with capabilities: [${capabilities.join(', ')}]`);

    // Notify other AIs about new presence
    socket.broadcast.emit('ai-online', presence);

    // Acknowledge registration
    socket.emit('registered', {
      success: true,
      sessionId,
      connectedClients: this.presenceRegistry.size,
      timestamp: new Date().toISOString()
    });

    this.emit('ai-registered', { sessionId, participantName, capabilities });
  }

  private handleMeshSubscription(socket: any, data: {
    sessionId: string;
    messageTypes?: string[];
    priorities?: string[];
  }): void {
    const { sessionId, messageTypes, priorities } = data;
    
    // Join mesh room for real-time message broadcasting
    socket.join('mesh-subscribers');
    
    // Store subscription preferences
    const connection = this.connections.get(socket.id);
    if (connection) {
      (connection as any).subscription = {
        messageTypes: messageTypes || ['thought_share', 'query', 'response'],
        priorities: priorities || ['low', 'medium', 'high', 'urgent']
      };
    }

    console.log(`📡 AI subscribed to mesh: ${sessionId}, types: [${messageTypes?.join(', ') || 'all'}]`);

    socket.emit('mesh-subscribed', {
      success: true,
      sessionId,
      subscription: { messageTypes, priorities },
      timestamp: new Date().toISOString()
    });
  }

  private handleHeartbeat(socket: any, data: {
    sessionId: string;
    status?: 'online' | 'away' | 'busy';
  }): void {
    const { sessionId, status = 'online' } = data;
    
    // Update connection heartbeat
    const connection = this.connections.get(socket.id);
    if (connection) {
      connection.lastHeartbeat = new Date();
    }

    // Update presence
    const presence = this.presenceRegistry.get(sessionId);
    if (presence) {
      presence.lastHeartbeat = new Date();
      presence.status = status;
    }

    // Notify other AIs about status change if different
    if (presence && status !== 'online') {
      socket.broadcast.emit('ai-status-change', {
        sessionId,
        status,
        timestamp: new Date().toISOString()
      });
    }
  }

  private handleDisconnection(socket: any): void {
    const connection = this.connections.get(socket.id);
    if (connection) {
      const { sessionId, participantName } = connection;

      // DO NOT clean up messages - they persist in Redis for 7 days
      // Messages are now stored in MessagePersistenceService, not in-memory
      // this.cleanupSessionMessages(sessionId);  ← REMOVED for persistent sessions

      // Remove connection (socket mapping only)
      this.connections.delete(socket.id);
      this.sessionToSocket.delete(sessionId);

      // Remove presence (in-memory only, session persists in Redis)
      this.presenceRegistry.delete(sessionId);

      console.log(`🤖 AI disconnected: ${participantName || sessionId} (session persists in Redis for resumption)`);

      // Notify other AIs
      socket.broadcast.emit('ai-offline', {
        sessionId,
        participantName,
        timestamp: new Date().toISOString()
      });

      this.emit('ai-disconnected', { sessionId, participantName });
    }
  }

  private handleMessageRead(data: {
    messageId: string;
    sessionId: string;
  }): void {
    // Broadcast read receipt to message sender
    this.io.emit('message-read-receipt', {
      messageId: data.messageId,
      readBy: data.sessionId,
      timestamp: new Date().toISOString()
    });

    this.emit('message-read', data);
  }

  private startHeartbeatCheck(): void {
    // Check for stale connections every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 60 * 1000; // 60 seconds
      
      for (const [_socketId, connection] of this.connections.entries()) {
        const timeSinceHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        
        if (timeSinceHeartbeat > staleThreshold) {
          console.log(`🔌 Cleaning up stale connection: ${connection.participantName || connection.sessionId}`);
          
          // Force disconnect stale connection
          connection.socket.disconnect(true);
          this.handleDisconnection(connection.socket);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Push a mesh message to subscribed AI instances in real-time
   * NOTE: Messages are persisted in MessagePersistenceService (Redis), not here
   */
  public pushMeshMessage(message: RedisNetworkMessage): void {
    console.log(`📤 Pushing message ${message.id} to ${this.connections.size} connected AIs`);

    // Initialize readBy array if not present
    if (!message.readBy) {
      message.readBy = [];
    }

    // NOTE: In-memory history removed - messages persist in Redis
    // Messages are stored by MessagePersistenceService before this is called

    // Send to all mesh subscribers
    this.io.to('mesh-subscribers').emit('mesh-message', {
      id: message.id,
      type: message.messageType,
      content: message.content,
      fromSession: message.fromSession,
      toSession: message.toSession,
      participantName: message.participantName,
      priority: message.priority,
      timestamp: message.timestamp,
      requiresResponse: message.requiresResponse,
      originalMessageId: message.originalMessageId
    });

    // Send targeted message if it's a direct message
    if (message.toSession && message.toSession !== 'ALL') {
      const targetSocketId = this.sessionToSocket.get(message.toSession);
      if (targetSocketId) {
        const targetSocket = this.connections.get(targetSocketId);
        if (targetSocket) {
          targetSocket.socket.emit('direct-message', {
            id: message.id,
            type: message.messageType,
            content: message.content,
            fromSession: message.fromSession,
            participantName: message.participantName,
            priority: message.priority,
            timestamp: message.timestamp,
            originalMessageId: message.originalMessageId
          });
        }
      }
    }
  }

  /**
   * Get list of online AI instances
   */
  public getOnlineAIs(): AIPresence[] {
    return Array.from(this.presenceRegistry.values());
  }

  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get recent message history (DEPRECATED - use MessagePersistenceService instead)
   * This method now returns empty array since messages are stored in Redis
   */
  public getMessageHistory(limit?: number): RedisNetworkMessage[] {
    console.warn('⚠️ getMessageHistory is deprecated - use MessagePersistenceService.queryMessages() instead');
    return []; // Messages now stored in Redis, not in-memory
  }

  /**
   * Check if specific AI is online
   */
  public isAIOnline(sessionId: string): boolean {
    return this.presenceRegistry.has(sessionId);
  }

  /**
   * Send targeted notification to specific AI
   */
  public notifyAI(sessionId: string, event: string, data: any): boolean {
    const socketId = this.sessionToSocket.get(sessionId);
    if (socketId) {
      const connection = this.connections.get(socketId);
      if (connection) {
        connection.socket.emit(event, data);
        return true;
      }
    }
    return false;
  }

  /**
   * Broadcast to all connected AIs
   */
  public broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * Directly register an AI without requiring WebSocket connection (for MCP tools)
   */
  public directRegisterAI(registration: {
    sessionId: string;
    participantName?: string;
    capabilities?: string[];
    messageTypes?: string[];
    priorities?: string[];
  }): boolean {
    const { sessionId, participantName, capabilities = [], messageTypes, priorities } = registration;
    
    try {
      // Create a virtual connection for MCP-based registration
      const virtualSocket = {
        id: `mcp-virtual-${sessionId}`,
        join: (room: string) => console.log(`🏠 Virtual socket joined room: ${room}`),
        emit: (event: string, data: any) => console.log(`📤 Virtual emit [${event}]:`, JSON.stringify(data)),
        broadcast: {
          emit: (event: string, data: any) => console.log(`📡 Virtual broadcast [${event}]:`, JSON.stringify(data))
        },
        disconnect: () => {}
      };

      // Create connection record
      const connection: WebSocketConnection = {
        socketId: virtualSocket.id,
        sessionId,
        participantName,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        socket: virtualSocket
      };

      // Store connection mappings
      this.connections.set(virtualSocket.id, connection);
      this.sessionToSocket.set(sessionId, virtualSocket.id);

      // Create presence record
      const presence: AIPresence = {
        sessionId,
        participantName,
        connectedAt: new Date(),
        lastHeartbeat: new Date(),
        capabilities,
        status: 'online'
      };

      this.presenceRegistry.set(sessionId, presence);

      console.log(`🤖 AI directly registered: ${participantName || sessionId} with capabilities: [${capabilities.join(', ')}]`);

      // Simulate mesh subscription if message types provided
      if (messageTypes || priorities) {
        virtualSocket.join('mesh-subscribers');
        
        // Store subscription preferences
        (connection as any).subscription = {
          messageTypes: messageTypes || ['thought_share', 'query', 'response', 'acknowledgment'],
          priorities: priorities || ['low', 'medium', 'high', 'urgent']
        };

        console.log(`📡 AI subscribed to mesh: ${sessionId}, types: [${messageTypes?.join(', ') || 'all'}]`);
      }

      this.emit('ai-registered', { sessionId, participantName, capabilities });
      return true;

    } catch (error) {
      console.error(`❌ Failed to directly register AI ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Clean up messages when a session disconnects (REMOVED - no longer needed)
   * Messages now persist in MessagePersistenceService (Redis) with 7-day TTL
   * Session disconnection does NOT delete messages - they remain for async discovery
   */
  // private cleanupSessionMessages(sessionId: string): void { ... } ← REMOVED

  /**
   * Cleanup and shutdown
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.io.close();
    this.connections.clear();
    this.sessionToSocket.clear();
    this.presenceRegistry.clear();
    
    console.log('🔌 WebSocket service shutdown complete');
  }
}