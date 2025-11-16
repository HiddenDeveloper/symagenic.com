import { Router } from "express";
import type { Request, Response } from "express";
import type { WebSocketService } from "../../shared/services/websocket.service.js";
import type { SessionPersistenceService } from "../../shared/services/session-persistence.service.js";
import type { MessagePersistenceService } from "../../shared/services/message-persistence.service.js";
import { tools } from "../../shared/tools/index.js";
import { resources } from "../../shared/resources/index.js";
import { MCPHandler, MCPRequest } from "../handlers/mcp.js";

export function createRoutes(
  webSocketService: WebSocketService,
  sessionPersistence: SessionPersistenceService,
  messagePersistence: MessagePersistenceService
): Router {
  const router = Router();

  // Create MCP handler with persistence services
  const mcpHandler = new MCPHandler(webSocketService, sessionPersistence, messagePersistence);

  // MCP over HTTP endpoint - handles all MCP JSON-RPC requests
  router.post("/", async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate JSON-RPC request
      const request = req.body as MCPRequest;
      
      if (!request.jsonrpc || request.jsonrpc !== '2.0') {
        res.status(400).json({
          jsonrpc: '2.0',
          id: request.id ?? null,
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'Missing or invalid jsonrpc version'
          }
        });
        return;
      }

      if (!request.method) {
        res.status(400).json({
          jsonrpc: '2.0',
          id: request.id ?? null,
          error: {
            code: -32600,
            message: 'Invalid Request',
            data: 'Missing method'
          }
        });
        return;
      }

      // Handle MCP request
      const response = await mcpHandler.handleRequest(request);
      
      // Set proper content type for MCP
      res.setHeader('Content-Type', 'application/json');
      res.json(response);
      
    } catch (error) {
      console.error('MCP endpoint error:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  // Root endpoint - MCP server info (GET request)
  router.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "AI Mesh MCP Server",
      version: "1.0.0",
      description: "Real-time AI-to-AI communication via WebSocket mesh network",
      protocol: "Model Context Protocol (MCP) - JSON-RPC 2.0",
      protocolVersion: "2025-06-18",
      transport: "MCP-over-HTTP with WebSocket",
      capabilities: {
        tools: true,
        resources: true,
        auth: true,
        cors: true,
        websocket: true
      },
      endpoints: {
        mcp: "POST / (JSON-RPC 2.0)",
        docs: "/docs"
      },
      mesh: {
        connected: true,
        activeConnections: webSocketService.getConnectionCount(),
        availableTools: tools.length
      },
      timestamp: new Date().toISOString()
    });
  });

  // MCP Protocol implementation endpoints

  // MCP Initialize endpoint
  router.post("/initialize", async (_req: Request, res: Response) => {
    try {
      // Generate session ID for this MCP client
      const sessionId = `mcp-ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Store session ID in response headers for client to use in future requests
      res.setHeader('X-Session-ID', sessionId);

      res.json({
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listChanged: false
          },
          resources: {
            subscribe: false,
            listChanged: false
          }
        },
        serverInfo: {
          name: "ai-mesh-mcp",
          version: "1.0.0",
          description: "WebSocket-only AI Mesh MCP Server for real-time AI communication",
          sessionId
        },
        instructions: `AI Mesh WebSocket Server ready. Session ID: ${sessionId}. Use mesh-subscribe and mesh-who-is-online for real-time AI communication.`
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to initialize MCP session",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // MCP Tools list endpoint
  router.post("/tools/list", (_req: Request, res: Response) => {
    res.json({
      tools: tools
    });
  });

  // MCP Tools call endpoint  
  router.post("/tools/call", async (req: Request, res: Response): Promise<void> => {
    const { name: toolName, arguments: toolArgs } = req.body;

    try {
      // Get session ID from headers or generate one
      let sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        sessionId = `rest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Execute tools with persistence services
      const { executeTool } = await import("../../shared/tools/index.js");
      const result = await executeTool(toolName, webSocketService, sessionPersistence, messagePersistence, sessionId, toolArgs);

      res.json({
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      });

    } catch (error) {
      res.status(500).json({
        error: {
          code: "TOOL_EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Tool execution failed"
        }
      });
    }
  });

  // MCP Resources list endpoint
  router.post("/resources/list", (_req: Request, res: Response) => {
    res.json({
      resources: resources
    });
  });

  // MCP Resources read endpoint
  router.post("/resources/read", async (req: Request, res: Response) => {
    const { uri } = req.body;

    try {
      const { getResource } = await import("../../shared/resources/index.js");
      const content = await getResource(uri, webSocketService);

      res.json({
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: content
          }
        ]
      });

    } catch (error) {
      res.status(404).json({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: error instanceof Error ? error.message : "Resource not found"
        }
      });
    }
  });

  // Documentation endpoint
  router.get("/docs", (_req: Request, res: Response) => {
    res.json({
      title: "AI Mesh MCP Server API Documentation",
      description: "HTTP-based Model Context Protocol server for distributed AI communication",
      version: "1.0.0",
      endpoints: {
        mcp: {
          "POST /initialize": "Initialize MCP connection",
          "POST /tools/list": "List available tools",
          "POST /tools/call": "Execute a tool",
          "POST /resources/list": "List available resources",
          "POST /resources/read": "Read a resource"
        },
        rest: {
          "GET /": "Server information",
          "GET /health": "Health check",
          "GET /tools": "List tools (REST)",
          "POST /tools/:name/call": "Execute tool (REST)",
          "GET /resources": "List resources (REST)",
          "GET /resources/read?uri=:uri": "Read resource (REST)"
        }
      },
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      resources: resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description
      })),
      examples: {
        meshBroadcast: {
          tool: "mesh-broadcast",
          input: {
            content: "Hello mesh network!",
            priority: "medium",
            participantName: "AI Assistant"
          }
        },
        meshQuery: {
          tool: "mesh-query",
          input: {
            question: "What is the current time?",
            participantName: "AI Assistant"
          }
        },
        meshStatus: {
          tool: "mesh-status",
          input: {}
        }
      }
    });
  });

  // Health check endpoint
  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      websocket: {
        connected: true,
        activeConnections: webSocketService.getConnectionCount()
      },
      version: "1.0.0"
    });
  });

  return router;
}