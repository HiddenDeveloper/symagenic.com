import express from "express";
import type { Application, Request, Response } from "express";
import { createServer } from "http";
import type { Server as HttpServer } from "http";

// Import services
import { WebSocketService } from "../shared/services/websocket.service.js";
import { SessionPersistenceService } from "../shared/services/session-persistence.service.js";
import { MessagePersistenceService } from "../shared/services/message-persistence.service.js";

// Import middleware
import { createCorsMiddleware, handlePreflight } from "./middleware/cors.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createRequestLoggingMiddleware, createErrorLoggingMiddleware, createLogger } from "./middleware/logging.js";

// Import routes
import { createRoutes } from "./routes/index.js";

// Import configuration
import { httpServerSettings, validateSettings, logSettings } from "./config/settings.js";

export class AiMeshHttpServer {
  private app: Application;
  private httpServer: HttpServer;
  private webSocketService: WebSocketService;
  private sessionPersistence: SessionPersistenceService;
  private messagePersistence: MessagePersistenceService;
  private logger: ReturnType<typeof createLogger>;
  private server: any;

  constructor() {
    // Validate configuration
    validateSettings(httpServerSettings);
    logSettings(httpServerSettings);

    // Initialize clean WebSocket-only architecture
    this.logger = createLogger(httpServerSettings);
    this.app = express();
    this.httpServer = createServer(this.app);
    this.webSocketService = new WebSocketService(this.httpServer);

    // Initialize persistence services
    const redisUrl = process.env['REDIS_URL'] || "redis://localhost:6379";
    const sessionTTL = 7 * 24 * 60 * 60; // 7 days in seconds
    const heartbeatTimeout = 30 * 60; // 30 minutes in seconds
    const messageTTL = 7 * 24 * 60 * 60; // 7 days in seconds

    this.sessionPersistence = new SessionPersistenceService({
      redisUrl,
      sessionTTL,
      heartbeatTimeout
    });

    this.messagePersistence = new MessagePersistenceService({
      redisUrl,
      messageTTL
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWebSocketEventHandlers();
    this.setupCleanShutdown();
  }

  private setupMiddleware(): void {
    // Request logging (first)
    this.app.use(createRequestLoggingMiddleware(httpServerSettings));

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // CORS
    this.app.use(createCorsMiddleware(httpServerSettings));
    this.app.use(handlePreflight);

    // Authentication
    this.app.use(createAuthMiddleware(httpServerSettings));

    // Add WebSocket context to requests
    this.app.use((req: Request, _res: Response, next) => {
      (req as any).meshContext = {
        sessionId: httpServerSettings.mesh.sessionId,
        participantName: httpServerSettings.mesh.participantName,
        connected: true // WebSocket is always available
      };
      next();
    });
  }

  private setupRoutes(): void {
    // Mount all routes with persistence services
    this.app.use("/", createRoutes(
      this.webSocketService,
      this.sessionPersistence,
      this.messagePersistence
    ));

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: "Not Found",
        message: "The requested endpoint does not exist",
        availableEndpoints: [
          "/",
          "/health",
          "/tools",
          "/resources",
          "/docs"
        ],
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler (must be last)
    this.app.use(createErrorLoggingMiddleware(httpServerSettings));
  }

  private setupCleanShutdown(): void {
    // Handle process signals for graceful shutdown
    process.on("SIGTERM", () => this.shutdown("SIGTERM"));
    process.on("SIGINT", () => this.shutdown("SIGINT"));
  }

  private setupWebSocketEventHandlers(): void {
    // Handle AI registration events
    this.webSocketService.on('ai-registered', (data) => {
      this.logger.info(`AI registered via WebSocket: ${data.participantName || data.sessionId} with capabilities: [${data.capabilities?.join(', ') || 'none'}]`);
    });

    // Handle AI disconnection events
    this.webSocketService.on('ai-disconnected', (data) => {
      this.logger.info(`AI disconnected from WebSocket: ${data.participantName || data.sessionId}`);
    });

    // Handle message read receipts
    this.webSocketService.on('message-read', (data) => {
      this.logger.debug(`Message read receipt: ${data.messageId} read by ${data.sessionId}`);
    });
  }


  public async start(): Promise<void> {
    try {
      // Initialize persistence services
      await this.sessionPersistence.connect();
      await this.messagePersistence.connect();
      this.logger.info("✅ Redis persistence services connected");

      // Start HTTP server
      return new Promise((resolve, reject) => {
        try {
          this.server = this.httpServer.listen(httpServerSettings.port, httpServerSettings.host, () => {
            this.logger.info(`🚀 AI Mesh WebSocket Server started on ${httpServerSettings.host}:${httpServerSettings.port}`);
            this.logger.info(`📡 Real-time AI communication ready via WebSocket`);
            this.logger.info(`💾 Persistent sessions and messages enabled (7-day retention)`);
            this.logger.info(`🆔 Session: ${httpServerSettings.mesh.sessionId}`);
            this.logger.info(`👤 Participant: ${httpServerSettings.mesh.participantName || "Anonymous"}`);
            this.logger.info(`🔐 Auth enabled: ${httpServerSettings.auth.enabled}`);
            resolve();
          });

          this.server.on("error", (error: Error) => {
            this.logger.error("Server error:", error);
            reject(error);
          });

        } catch (error) {
          this.logger.error("Failed to start server:", error);
          reject(error);
        }
      });
    } catch (error) {
      this.logger.error("Failed to initialize persistence services:", error);
      throw error;
    }
  }

  public async shutdown(signal?: string): Promise<void> {
    this.logger.info(`🛑 Shutting down AI Mesh WebSocket Server${signal ? ` (${signal})` : ""}...`);

    try {
      // Close WebSocket service
      this.webSocketService.shutdown();

      // Close persistence services
      await this.sessionPersistence.shutdown();
      await this.messagePersistence.shutdown();
      this.logger.info("✅ Persistence services closed");

      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            this.logger.info("✅ HTTP server closed");
            resolve();
          });
        });
      }

      this.logger.info("✨ AI Mesh WebSocket Server shutdown complete");

      // Exit process if shutdown was triggered by signal
      if (signal) {
        process.exit(0);
      }

    } catch (error) {
      this.logger.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  }

  public getApp(): Application {
    return this.app;
  }

  public getWebSocketService(): WebSocketService {
    return this.webSocketService;
  }

  public getSessionPersistence(): SessionPersistenceService {
    return this.sessionPersistence;
  }

  public getMessagePersistence(): MessagePersistenceService {
    return this.messagePersistence;
  }

  public isHealthy(): boolean {
    return this.webSocketService.getConnectionCount() >= 0; // WebSocket service is always healthy
  }
}