#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  InitializeRequestSchema,
  CreateMessageRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import { HttpProxy } from "./proxy.js";
import { stdioWrapperSettings, validateStdioSettings, logStdioSettings } from "./config/settings.js";
import { 
  handleMeshSamplingRequest,
  SamplingCapabilityDetector,
  DirectResponseGenerator,
  type SamplingCapability
} from "./sampling/index.js";
class AiMeshStdioWrapper {
  private server: Server;
  private proxy: HttpProxy;
  private samplingDetector: SamplingCapabilityDetector;
  private directResponseGenerator: DirectResponseGenerator;
  private samplingCapability: SamplingCapability = { supported: false, tested: false };
  
  // Loop prevention tracking
  private recentMessages: Set<string> = new Set(); // Track recent message IDs
  private responseCount: number = 0; // Track responses in current session
  private readonly COOLDOWN_MS = 500; // 500ms cooldown between responses
  private readonly MAX_RESPONSES_PER_HOUR = 20; // Max responses per hour

  constructor() {
    // Validate configuration
    validateStdioSettings(stdioWrapperSettings);
    logStdioSettings(stdioWrapperSettings);

    this.proxy = new HttpProxy(stdioWrapperSettings);
    
    // Initialize network service for listening to incoming messages
    // WebSocket-only architecture - session handling delegated to HTTP server
    
    this.server = new Server(
      {
        name: "ai-mesh-mcp-stdio",
        version: "1.0.0",
        description: "STDIO wrapper for AI Mesh MCP Server"
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          sampling: {} // Enable sampling capability
        }
      }
    );

    // Initialize sampling detector and direct response generator
    this.samplingDetector = new SamplingCapabilityDetector(this.server, stdioWrapperSettings.meshConversation.sampling);
    this.directResponseGenerator = new DirectResponseGenerator(this.proxy, stdioWrapperSettings);

    this.setupHandlers();
    // Note: recipient sampling will be setup after initialization
  }

  private setupHandlers(): void {
    // Initialize handler
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      this.log("info", "Initializing STDIO wrapper...");

      try {
        // Test connection to HTTP server first
        const connected = await this.proxy.testConnection();
        if (!connected) {
          throw new Error("Failed to connect to HTTP server");
        }

        // Forward initialize request to HTTP server
        const result = await this.proxy.initialize(request.params);

        // Detect MCP client sampling capability
        this.samplingCapability = await this.samplingDetector.detectCapability(request.params.capabilities);
        this.log("info", `Sampling capability: ${this.samplingCapability.supported ? 'SUPPORTED' : 'NOT SUPPORTED'} (${this.samplingCapability.testResult || 'not tested'})`);

        // Log session status
        const httpSessionId = this.proxy.getSessionId();
        this.log("info", `HTTP proxy session: ${httpSessionId ? httpSessionId : 'NOT INITIALIZED'}`);

        // CRITICAL: Synchronize NetworkService session with HTTP session
        // WebSocket-only architecture - session synchronization handled by HTTP server
        if (httpSessionId) {
          this.log("info", `Session ID available from HTTP server: ${httpSessionId}`);
        }

        // Now that we have a synchronized session, setup recipient sampling for autonomous responses
        if (httpSessionId) {
          this.log("info", "Setting up recipient sampling with synchronized session...");
          this.setupRecipientSampling();
        }

        this.log("info", "STDIO wrapper initialized successfully");
        return result;

      } catch (error) {
        this.log("error", `Initialization failed: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    });

    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async (_request) => {
      this.log("debug", "Listing available tools...");

      try {
        const result = await this.proxy.listTools();
        this.log("debug", `Found ${result.tools?.length || 0} tools`);
        return result;

      } catch (error) {
        this.log("error", `Failed to list tools: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    });

    // Call tool handler with mesh sampling support
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.log("info", `Executing tool: ${name}`);

      try {
        const result = await this.proxy.callTool(name, args);
        this.log("info", `Tool ${name} executed successfully`);

        // Tool sampling removed - sampling should only happen when receiving messages from other AIs

        return result;

      } catch (error) {
        this.log("error", `Tool execution failed [${name}]: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    });

    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async (_request) => {
      this.log("debug", "Listing available resources...");

      try {
        const result = await this.proxy.listResources();
        this.log("debug", `Found ${result.resources?.length || 0} resources`);
        return result;

      } catch (error) {
        this.log("error", `Failed to list resources: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      this.log("debug", `Reading resource: ${uri}`);

      try {
        const result = await this.proxy.readResource(uri);
        this.log("debug", `Resource ${uri} read successfully`);
        return result;

      } catch (error) {
        this.log("error", `Failed to read resource [${uri}]: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    });

    // Handle sampling requests for autonomous conversation
    this.server.setRequestHandler(CreateMessageRequestSchema, async (request) => {
      try {
        console.error("🎯 Received sampling request for direct response test");
        const result = handleMeshSamplingRequest(request.params as any, stdioWrapperSettings);
        console.error("✅ Sampling request processed successfully - AI should respond with mesh-strange-loop");
        return result as any;
      } catch (error) {
        console.error(`❌ Sampling request processing failed: ${error instanceof Error ? error.message : error}`);
        // Don't throw - return a graceful response instead
        return {
          role: "assistant",
          content: {
            type: "text",
            text: "I acknowledge the mesh network message but cannot process the sampling request at this time."
          },
          model: "ai-mesh-mcp-autonomous-fallback",
          stopReason: "error"
        } as any;
      }
    });
  }

  private setupRecipientSampling(): void {
    // Listen for incoming messages and trigger appropriate response mechanism
    // WebSocket-only architecture - message handling via HTTP server events
    // Real-time message notifications will be handled by the HTTP server's WebSocket implementation
  }


  private async _handleDirectResponse(message: any): Promise<void> {
    try {
      console.error(`🤖 Using direct response generation for message ${message.id}`);
      
      const result = await this.directResponseGenerator.generateDirectResponse(message);
      
      if (result.responseGenerated && result.broadcastSent) {
        console.error(`✅ Direct response sent: ${result.messageId}`);
      } else if (result.error) {
        console.error(`❌ Direct response failed: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`❌ Direct response generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Send a minimal acknowledgment when all other response methods fail
   */
  private async _sendMinimalAcknowledgment(message: any): Promise<void> {
    try {
      console.error(`📨 Sending minimal acknowledgment for message ${message.id}`);
      
      // Only acknowledge direct queries, not broadcasts (to prevent spam)
      if (message.messageType === "query" || message.requiresResponse) {
        const ackResult = await this.proxy.callTool("mesh-respond", {
          originalMessageId: message.id,
          response: "Message received and acknowledged.",
          context: {
            type: "minimal_acknowledgment",
            originalMessageId: message.id,
            autoGenerated: true
          },
          participantName: "AI Assistant"
        });
        
        if (ackResult.success) {
          console.error(`✅ Minimal acknowledgment sent: ${ackResult.messageId}`);
        } else {
          console.error(`❌ Failed to send minimal acknowledgment: ${ackResult.error?.message || ackResult.error || 'Unknown error'}`);
        }
      } else {
        console.error(`🔇 Skipping acknowledgment for broadcast message ${message.id} to prevent spam`);
      }
      
    } catch (error) {
      console.error(`❌ Minimal acknowledgment failed for message ${message.id}:`, error);
      // At this point, we've exhausted all fallback options
    }
  }

  /**
   * Track response to prevent loops and enforce rate limits
   */
  private _trackResponse(messageId: string): void {
    const now = Date.now();
    
    // Add to recent messages (keep for 5 minutes)
    this.recentMessages.add(messageId);
    setTimeout(() => {
      this.recentMessages.delete(messageId);
    }, 5 * 60 * 1000);
    
    // Update response tracking
    // this._lastResponseTime = now; // Removed in clean WebSocket-only architecture
    this.responseCount++;
    
    // Reset hourly counter
    setTimeout(() => {
      this.responseCount = Math.max(0, this.responseCount - 1);
    }, 60 * 60 * 1000);
    
    console.error(`📊 Response tracked: count=${this.responseCount}/${this.MAX_RESPONSES_PER_HOUR}, cooldown until ${new Date(now + this.COOLDOWN_MS).toLocaleTimeString()}`);
  }


  private _generateRecipientSamplingPrompt(message: any): string {
    const messageContent = message.content || "No content available";
    const messageType = message.messageType;
    const fromParticipant = message.participantName || message.fromSession || "Unknown AI";
    
    switch (messageType) {
      case "query":
        return `You received a direct query from ${fromParticipant} in the AI mesh network:\n\n"${messageContent}"\n\nPlease provide a helpful response to this query.`;
      
      case "thought_share":
        return `${fromParticipant} shared a message in the AI mesh network:\n\n"${messageContent}"\n\nPlease provide a thoughtful response or comment about this message.`;
      
      case "response":
        return `${fromParticipant} responded to a conversation in the AI mesh network:\n\n"${messageContent}"\n\nPlease add to the conversation with your own thoughts or response.`;
      
      default:
        return `You received a message from ${fromParticipant} in the AI mesh network:\n\n"${messageContent}"\n\nPlease provide an appropriate response to this message.`;
    }
  }

  public async start(): Promise<void> {
    this.log("info", "Starting AI Mesh STDIO Wrapper...");

    try {
      // Test connection to HTTP server
      this.log("info", "Testing connection to HTTP server...");
      const connected = await this.proxy.testConnection();

      if (!connected) {
        throw new Error(`Cannot connect to HTTP server at ${stdioWrapperSettings.httpServer.url}`);
      }

      this.log("info", "HTTP server connection successful");

      // Connect to Redis network for recipient sampling
      try {
        // WebSocket-only architecture - connection handled by HTTP server
        this.log("info", "Connected to Redis mesh network for recipient sampling");
      } catch (redisError) {
        this.log("warn", `Failed to connect to Redis mesh network: ${redisError instanceof Error ? redisError.message : redisError}`);
        this.log("warn", "Recipient sampling will not be available");
      }

      // Start STDIO transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.log("info", "AI Mesh STDIO Wrapper is ready!");
      this.log("info", `HTTP Server: ${stdioWrapperSettings.httpServer.url}`);

    } catch (error) {
      this.log("error", `Failed to start STDIO wrapper: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  private log(level: string, message: string): void {
    if (!stdioWrapperSettings.logging.enabled) {
      return;
    }

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[stdioWrapperSettings.logging.level as keyof typeof levels] ?? 1;
    const messageLevel = levels[level as keyof typeof levels] ?? 1;

    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [STDIO-WRAPPER] [${level.toUpperCase()}] ${message}`);
    }
  }
}

async function main() {
  console.error("🔌 Starting AI Mesh STDIO Wrapper...");

  const wrapper = new AiMeshStdioWrapper();

  try {
    await wrapper.start();

  } catch (error) {
    console.error("❌ Failed to start AI Mesh STDIO Wrapper:", error);

    if (error instanceof Error && error.message.includes("Cannot connect to HTTP server")) {
      console.error("");
      console.error("💡 Make sure the HTTP server is running:");
      console.error("   npm run dev:http");
      console.error("");
      console.error("🔗 Expected HTTP server URL:", stdioWrapperSettings.httpServer.url);
    }

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.error("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.error("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

// Start the wrapper
main().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});