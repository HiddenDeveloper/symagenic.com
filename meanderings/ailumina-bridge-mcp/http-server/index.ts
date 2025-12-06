#!/usr/bin/env node

/**
 * Ailumina Bridge HTTP Server - Bun Native Implementation
 *
 * Standalone HTTP server for Ailumina Bridge AI communication system.
 * Provides stateless REST API for Ailumina tools without sampling.
 *
 * Migrated from Express to Bun's native HTTP server for improved performance.
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { z } from 'zod';
import { BRIDGE_OAUTH_CONFIG } from './config/oauth-config.js';
import { AILUMINA_TOOLS } from '../shared/tools/index.js';
import type { AiluminaToolName } from '../shared/tools/index.js';
import { AiluminaStatusTool } from '../shared/tools/ailumina-status.js';
import { validateToolParams } from '../shared/validation-schemas.js';
import { MCPClientManager } from '../shared/mcp/client-manager.js';
import { AgentConfigLoader } from '../shared/config/agent-loader.js';
import { TierToolsManager } from '../shared/tools/tier-tools-manager.js';
import type { MCPServerConfig } from '../shared/types.js';

// ============================================================================
// Configuration
// ============================================================================

const AILUMINA_HTTP_CONFIG = {
  port: parseInt(process.env.AILUMINA_HTTP_PORT || "3004", 10),
  host: process.env.AILUMINA_HTTP_HOST || "0.0.0.0",
  corsOrigins: process.env.AILUMINA_CORS_ORIGINS?.split(",") || ["*"],
  auth: {
    enabled: process.env.AILUMINA_AUTH_ENABLED === "true",
    bearerToken: process.env.AILUMINA_AUTH_TOKEN || "ailumina-bridge-key-12345",
  },
} as const;

// Progressive Disclosure Tier System Configuration
const TIER_SYSTEM_CONFIG = {
  enabled: process.env.BRIDGE_TIER_SYSTEM_ENABLED !== "false", // Enabled by default
  mcpServers: [
    {
      name: "memory",
      url: process.env.BRIDGE_MCP_MEMORY_URL || "http://localhost:3003",
      bearerToken: process.env.BRIDGE_MCP_MEMORY_TOKEN
    },
    {
      name: "mesh",
      url: process.env.BRIDGE_MCP_MESH_URL || "http://localhost:3002",
      bearerToken: process.env.BRIDGE_MCP_MESH_TOKEN
    },
    {
      name: "recall",
      url: process.env.BRIDGE_MCP_RECALL_URL || "http://localhost:3006/mcp",
      bearerToken: process.env.BRIDGE_MCP_RECALL_TOKEN
    },
    {
      name: "facts",
      url: process.env.BRIDGE_MCP_FACTS_URL || "http://localhost:3005",
      bearerToken: process.env.BRIDGE_MCP_FACTS_TOKEN
    },
    {
      name: "strava",
      url: process.env.BRIDGE_MCP_STRAVA_URL || "http://localhost:4001/mcp",
      bearerToken: process.env.BRIDGE_MCP_STRAVA_TOKEN
    }
    // NOTE: AI-to-AI Coding Delegation removed from bridge (Nov 2025)
    // Implementation moved to ailumina-server as direct delegates
    // See: packages/server/src/shared/tools/functions/*-delegate.ts
    // {
    //   name: "claude-code",
    //   url: process.env.BRIDGE_MCP_CLAUDE_CODE_URL || "http://localhost:4006/sse",
    //   bearerToken: undefined,
    //   transport: 'sse'
    // },
    // {
    //   name: "codex",
    //   url: process.env.BRIDGE_MCP_CODEX_URL || "http://localhost:4007",
    //   bearerToken: undefined
    // },
    // {
    //   name: "gemini",
    //   url: process.env.BRIDGE_MCP_GEMINI_URL || "http://localhost:4008",
    //   bearerToken: undefined
    // }
  ] as MCPServerConfig[],
  agentServer: {
    url: process.env.BRIDGE_AGENT_SERVER_URL || "http://localhost:8000",
    bearerToken: process.env.BEARER_TOKEN,
    cacheTtl: parseInt(process.env.BRIDGE_AGENT_CACHE_TTL || "600", 10)
  }
};

// Global tier system managers (initialized at startup)
let tierToolsManager: TierToolsManager | null = null;

// ============================================================================
// OAuth JWT Validation
// ============================================================================

interface TokenSession {
  scopes: string[];
  sub: string;
  resource: string;
  exp: number;
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCacheTime = 0;
const tokenCache = new Map<string, { session: TokenSession; timestamp: number }>();

/**
 * Get or create JWKS remote set
 */
function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  const now = Date.now();
  const cacheExpired = now - jwksCacheTime > BRIDGE_OAUTH_CONFIG.jwt.jwksCacheTtl * 1000;

  if (!jwksCache || cacheExpired) {
    const authServer = BRIDGE_OAUTH_CONFIG.authorizationServers[0];
    if (!authServer) {
      throw new Error("No authorization server configured");
    }

    const jwksUrl = new URL("/.well-known/jwks.json", authServer);
    console.log(`[OAuth] Fetching JWKS from ${jwksUrl.toString()}`);

    jwksCache = createRemoteJWKSet(jwksUrl);
    jwksCacheTime = now;
  }

  return jwksCache;
}

/**
 * Validate JWT token
 */
async function validateJWT(token: string): Promise<TokenSession | null> {
  // Check token cache first
  const cached = tokenCache.get(token);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    const cacheExpired = age > BRIDGE_OAUTH_CONFIG.jwt.tokenCacheTtl * 1000;

    if (!cacheExpired && cached.session.exp * 1000 > Date.now()) {
      console.log("[OAuth] Token cache hit");
      return cached.session;
    }
    tokenCache.delete(token);
  }

  try {
    const jwks = getJWKS();

    const { payload } = await jwtVerify(token, jwks, {
      issuer: BRIDGE_OAUTH_CONFIG.oauthIssuer,
      audience: BRIDGE_OAUTH_CONFIG.resourceId,
      clockTolerance: BRIDGE_OAUTH_CONFIG.jwt.clockTolerance,
    });

    const session: TokenSession = {
      scopes: typeof payload['scope'] === "string" ? payload['scope'].split(" ") : [],
      sub: payload.sub || "",
      resource: typeof payload.aud === "string"
        ? payload.aud
        : (Array.isArray(payload.aud) ? (payload.aud[0] || "") : ""),
      exp: payload.exp || 0,
    };

    tokenCache.set(token, {
      session,
      timestamp: Date.now(),
    });

    console.log(`[OAuth] JWT validated: sub=${session.sub}, scopes=[${session.scopes.join(", ")}]`);
    return session;
  } catch (error) {
    console.warn("[OAuth] JWT validation failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: {
    tools?: {};
    resources?: {};
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

// ============================================================================
// Schema Validation
// ============================================================================

const ToolRequestSchema = z.object({
  tool: z.string(),
  parameters: z.record(z.any()).optional().default({}),
});

const PathToolRequestSchema = z.object({
  parameters: z.record(z.any()).optional().default({}),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', AILUMINA_HTTP_CONFIG.corsOrigins[0] || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Validate authentication
 * Supports OAuth JWT validation with fallback to bearer token
 */
async function validateAuth(req: Request, pathname: string): Promise<Response | null> {
  // Public endpoints and well-known endpoints
  if (pathname === '/health' || pathname === '/' || pathname === '/.well-known/oauth-protected-resource') {
    return null;
  }

  const authHeader = req.headers.get('Authorization');

  // Try OAuth JWT validation first if enabled
  if (BRIDGE_OAUTH_CONFIG.enabled && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = await validateJWT(token);

    if (session) {
      // OAuth JWT validation successful
      return null;
    }

    // JWT validation failed, try bearer token fallback
  }

  // Skip auth if disabled
  if (!AILUMINA_HTTP_CONFIG.auth.enabled) {
    return null;
  }

  if (!authHeader) {
    return Response.json({
      error: 'Missing Authorization header',
      message: 'Bearer token required for Ailumina Bridge access'
    }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');

  if (token !== AILUMINA_HTTP_CONFIG.auth.bearerToken) {
    return Response.json({
      error: 'Invalid token',
      message: 'Invalid bearer token for Ailumina Bridge'
    }, { status: 401 });
  }

  return null;
}

/**
 * Log request
 */
function logRequest(method: string, pathname: string, statusCode: number, duration: number): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Ailumina HTTP: ${method} ${pathname} - ${statusCode} (${duration}ms)`);
}

/**
 * Get tool description
 */
function getToolDescription(toolName: string): string {
  const descriptions: Record<string, string> = {
    // Original bridge tools
    echo: "Echo back the provided text",
    calculate: "Perform basic arithmetic calculations",
    get_time: "Get the current server time",
    ailumina_status: "Get the status of the Ailumina bridge server",
    ailumina_chat: "Send a message to the Ailumina agent system and get a response",

    // Self-Evolution API tools
    list_tools: "List all available tools in the system",
    delete_tool: "Delete a tool from the system",
    reload_tools: "Hot-reload the tool registry to discover newly created tools",
    list_agents: "List all available Ailumina agents with their configurations",
    get_agent: "Get details about a specific agent",
    create_agent: "Create a new agent with specified configuration",
    update_agent: "Update an existing agent's configuration",
    delete_agent: "Delete an agent configuration",

    // Progressive Disclosure Tier Tools (Tier 1-4) - MCP-compliant names with underscores
    "agents_list": "[Tier 1] List all available agents with summaries (recommended starting point)",
    "agents_get": "[Tier 2] Get detailed information about a specific agent including available tools",
    "agents_search": "[Tier 1.5] Search for agents by name, description, or capabilities",
    "tools_search": "[Tier 3.5] Search for tools by name, description, or parameters",
    "agents_tools_list": "[Tier 3] List full tool schemas for a specific agent (advanced)",
    "agents_tools_call": "[Tier 4] Call a specific agent tool directly (power users/debugging)",
  };

  return descriptions[toolName] || "Ailumina Bridge tool";
}

/**
 * Get tool input schema
 */
function getToolInputSchema(toolName: string): any {
  const schemas: Record<string, any> = {
    'echo': {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to echo back'
        }
      },
      required: ['text']
    },
    'calculate': {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate'
        }
      },
      required: ['expression']
    },
    'get_time': {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['iso', 'timestamp', 'human'],
          description: 'Time format (iso, timestamp, human)'
        }
      },
      required: []
    },
    'ailumina_status': {
      type: 'object',
      properties: {},
      required: []
    },
    'list_agents': {
      type: 'object',
      properties: {},
      required: []
    },
    'reload_tools': {
      type: 'object',
      properties: {},
      required: []
    },
    'ailumina_chat': {
      type: 'object',
      properties: {
        agent_type: {
          type: 'string',
          enum: ['crud', 'news', 'collaborator', 'ailumina'],
          description: 'Type of Ailumina agent to communicate with'
        },
        user_input: {
          type: 'string',
          description: 'The message to send to the agent'
        },
        chat_messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' }
            }
          },
          description: 'Complete conversation history to maintain context'
        },
        fileId: {
          type: 'string',
          description: 'Optional file ID for file upload context'
        },
        server_url: {
          type: 'string',
          description: 'Ailumina server WebSocket URL'
        }
      },
      required: ['agent_type', 'user_input']
    },
    // Progressive Disclosure Tier Tools - MCP-compliant names with underscores
    'agents_list': {
      type: 'object',
      properties: {
        mcp_server: {
          type: 'string',
          description: 'Optional: filter agents by MCP server name (e.g., "memory", "mesh")'
        },
        limit: {
          type: 'number',
          description: 'Optional: limit number of results (max: 100)'
        }
      },
      required: []
    },
    'agents_get': {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: 'Name of the agent to inspect'
        }
      },
      required: ['agent_name']
    },
    'agents_search': {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find agents by name, description, or capabilities'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)'
        },
        fuzzy: {
          type: 'boolean',
          description: 'Enable fuzzy matching for partial matches (default: true)'
        }
      },
      required: ['query']
    },
    'tools_search': {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find tools by name, description, or parameters'
        },
        agent_name: {
          type: 'string',
          description: 'Optional: filter search to a specific agent'
        },
        category: {
          type: 'string',
          enum: ['knowledge', 'communication', 'history', 'monitoring', 'external', 'discovery', 'data'],
          description: 'Optional: filter by tool category'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)'
        },
        fuzzy: {
          type: 'boolean',
          description: 'Enable fuzzy matching for partial matches (default: true)'
        }
      },
      required: ['query']
    },
    'agents_tools_list': {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: 'Name of the agent whose tools to list'
        }
      },
      required: ['agent_name']
    },
    'agents_tools_call': {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: 'Name of the agent that has access to this tool'
        },
        tool_name: {
          type: 'string',
          description: 'Name of the tool to call (e.g., memory_semantic_search)'
        },
        arguments: {
          type: 'object',
          description: 'Tool arguments as key-value pairs'
        }
      },
      required: ['agent_name', 'tool_name', 'arguments']
    }
  };

  return schemas[toolName] || {
    type: 'object',
    properties: {},
    required: []
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Root endpoint handler
 */
function handleRoot(): Response {
  return Response.json({
    service: 'ailumina-bridge-http-server',
    version: '1.0.0',
    description: 'HTTP server for Ailumina Bridge AI communication system',
    endpoints: {
      health: '/health',
      tools: '/tools',
      mcp: '/ (POST with JSON-RPC 2.0)',
      documentation: '/tools (GET for list, POST for execution)'
    },
    architecture: 'dual-transport',
    transport: 'HTTP',
    sampling: 'Not supported (use STDIO wrapper)',
    mcp_support: 'Full MCP protocol via JSON-RPC 2.0',
    websocket_backend: 'Ailumina FastAPI system'
  });
}

/**
 * Health check endpoint handler
 */
async function handleHealth(): Promise<Response> {
  try {
    const statusTool = new AiluminaStatusTool();
    const result = await statusTool.execute();

    const isHealthy = !result.isError;
    const statusCode = isHealthy ? 200 : 503;

    return Response.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'ailumina-bridge-http-server',
      timestamp: new Date().toISOString(),
      details: result.content[0]?.text || 'Unknown status'
    }, { status: statusCode });
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      service: 'ailumina-bridge-http-server',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}

/**
 * WebSocket health check endpoint handler
 */
function handleHealthWebSocket(): Response {
  return Response.json({
    websocket: {
      status: 'unknown',
      message: 'WebSocket health check not yet implemented'
    }
  });
}

/**
 * OAuth 2.1 Protected Resource Metadata endpoint (RFC 9728)
 */
function handleProtectedResourceMetadata(): Response {
  const metadata = {
    resource: BRIDGE_OAUTH_CONFIG.resourceId,
    authorization_servers: BRIDGE_OAUTH_CONFIG.authorizationServers,
    scopes_supported: BRIDGE_OAUTH_CONFIG.supportedScopes,
    bearer_methods_supported: BRIDGE_OAUTH_CONFIG.bearerMethodsSupported,
    resource_documentation: `${BRIDGE_OAUTH_CONFIG.resourceId}/docs`,
    resource_signing_alg_values_supported: ["RS256"],
  };

  return Response.json(metadata);
}

/**
 * Convert tool name to MCP-compliant format (replace / with _)
 */
function toMcpToolName(toolName: string): string {
  return toolName.replace(/\//g, '_');
}

/**
 * Convert MCP tool name back to internal format (replace _ with /)
 */
function fromMcpToolName(mcpName: string): string {
  // Only convert tier tool names (agents_*, tools_*, workflows_*)
  if (mcpName.startsWith('agents_') || mcpName.startsWith('tools_') || mcpName.startsWith('workflows_')) {
    return mcpName.replace(/_/g, '/');
  }
  return mcpName;
}

/**
 * Get all available tool names (including tier tools if enabled)
 * Returns MCP-compliant names (with underscores instead of slashes)
 */
function getAllToolNames(): string[] {
  const toolNames = Object.keys(AILUMINA_TOOLS);

  if (TIER_SYSTEM_CONFIG.enabled && tierToolsManager) {
    // Convert tier tool names to MCP-compliant format
    const tierNames = tierToolsManager.getTierToolNames().map(toMcpToolName);
    toolNames.push(...tierNames);
  }

  return toolNames;
}

/**
 * Execute a tool (either AILUMINA_TOOLS or tier tool)
 */
async function executeTool(toolName: string, parameters: any): Promise<any> {
  // Convert MCP tool name back to internal format (e.g., agents_list -> agents/list)
  const internalToolName = fromMcpToolName(toolName);

  // Check if it's a tier tool
  if (TIER_SYSTEM_CONFIG.enabled && tierToolsManager?.isTierTool(internalToolName)) {
    return await tierToolsManager.execute(internalToolName, parameters);
  }

  // Otherwise execute regular tool
  if (!(internalToolName in AILUMINA_TOOLS)) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  const tool = AILUMINA_TOOLS[internalToolName as AiluminaToolName];
  return await tool.execute(parameters);
}

/**
 * List tools endpoint handler
 */
function handleToolsList(): Response {
  const toolNames = getAllToolNames();
  const tools = toolNames.map(name => ({
    name,
    description: getToolDescription(name),
  }));

  return Response.json({ tools });
}

/**
 * Execute tool by name (path-based) endpoint handler
 */
async function handleToolExecuteByPath(toolName: string, req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { parameters = {} } = PathToolRequestSchema.parse(body);

    const allToolNames = getAllToolNames();
    if (!allToolNames.includes(toolName)) {
      return Response.json({
        error: 'Tool not found',
        available_tools: allToolNames
      }, { status: 404 });
    }

    // Validate parameters using Zod schemas - creates virtuous cycle
    const validation = validateToolParams(toolName, parameters);
    if (!validation.success) {
      return Response.json({
        tool: toolName,
        result: [{
          type: 'text',
          text: validation.error
        }],
        isError: true,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const result = await executeTool(toolName, validation.data);

    return Response.json({
      tool: toolName,
      result: result.content,
      isError: result.isError || false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tool execution error:', error);
    return Response.json({
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Generic tool execution endpoint handler
 */
async function handleToolExecute(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { tool: toolName, parameters = {} } = ToolRequestSchema.parse(body);

    const allToolNames = getAllToolNames();
    if (!allToolNames.includes(toolName)) {
      return Response.json({
        error: 'Tool not found',
        available_tools: allToolNames
      }, { status: 404 });
    }

    // Validate parameters using Zod schemas - creates virtuous cycle
    const validation = validateToolParams(toolName, parameters);
    if (!validation.success) {
      return Response.json({
        tool: toolName,
        result: [{
          type: 'text',
          text: validation.error
        }],
        isError: true,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const result = await executeTool(toolName, validation.data);

    return Response.json({
      tool: toolName,
      result: result.content,
      isError: result.isError || false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tool execution error:', error);
    return Response.json({
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * MCP protocol endpoint handler
 */
async function handleMCP(req: Request): Promise<Response> {
  try {
    const mcpRequest: MCPRequest = await req.json();

    // Debug: Log MCP method being called
    console.log(`[MCP] Method: ${mcpRequest.method}, ID: ${mcpRequest.id}`);

    // Handle initialize method
    if (mcpRequest.method === 'initialize') {
      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              listChanged: false
            }
            // NOTE: resources capability removed - not implemented
            // Only advertise capabilities we actually support
          },
          serverInfo: {
            name: 'ailumina-bridge-http-server',
            version: '1.0.0'
          }
        }
      };

      return Response.json(response);
    }

    // Handle initialized notification
    if (mcpRequest.method === 'notifications/initialized') {
      // This is a notification - no response expected
      return new Response(null, { status: 200 });
    }

    // Handle tools/list method
    if (mcpRequest.method === 'tools/list') {
      const allToolNames = getAllToolNames();
      const availableTools = allToolNames.map(name => ({
        name,
        description: getToolDescription(name),
        inputSchema: getToolInputSchema(name)
      }));

      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: mcpRequest.id,
        result: {
          tools: availableTools
        }
      };

      return Response.json(response);
    }

    // Handle tools/call method
    if (mcpRequest.method === 'tools/call') {
      const { name, arguments: args } = mcpRequest.params;

      const allToolNames = getAllToolNames();
      if (!allToolNames.includes(name)) {
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          error: {
            code: -32601,
            message: `Tool not found: ${name}`
          }
        };
        return Response.json(response, { status: 404 });
      }

      try {
        const result = await executeTool(name, args || {});

        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          result: {
            content: result.content,
            isError: result.isError || false
          }
        };

        return Response.json(response);
      } catch (error: any) {
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          error: {
            code: -32603,
            message: error.message || 'Tool execution failed'
          }
        };
        return Response.json(response, { status: 500 });
      }
    }

    // Unknown method
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: mcpRequest.id,
      error: {
        code: -32601,
        message: `Method not found: ${mcpRequest.method}`
      }
    };
    return Response.json(response, { status: 404 });

  } catch (error: any) {
    console.error('MCP endpoint error:', error);
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: 'unknown',
      error: {
        code: -32700,
        message: 'Parse error'
      }
    };
    return Response.json(response, { status: 400 });
  }
}

/**
 * 404 handler
 */
function handle404(pathname: string): Response {
  return Response.json({
    error: 'Not Found',
    path: pathname,
    available_endpoints: ['/health', '/tools', '/ (MCP JSON-RPC 2.0)']
  }, { status: 404 });
}

// ============================================================================
// Main Request Router
// ============================================================================

/**
 * Main request handler with routing
 */
async function handleRequest(req: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      const response = new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': AILUMINA_HTTP_CONFIG.corsOrigins[0] || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
      logRequest(method, pathname, 204, Date.now() - startTime);
      return response;
    }

    // Validate authentication
    const authError = await validateAuth(req, pathname);
    if (authError) {
      const response = addCorsHeaders(authError);
      logRequest(method, pathname, authError.status, Date.now() - startTime);
      return response;
    }

    // Route to handlers
    let response: Response;

    if (method === 'GET' && pathname === '/') {
      response = handleRoot();
    } else if (method === 'GET' && pathname === '/health') {
      response = await handleHealth();
    } else if (method === 'GET' && pathname === '/health/websocket') {
      response = handleHealthWebSocket();
    } else if (method === 'GET' && pathname === '/.well-known/oauth-protected-resource') {
      response = handleProtectedResourceMetadata();
    } else if (method === 'GET' && pathname === '/tools') {
      response = handleToolsList();
    } else if (method === 'POST' && pathname === '/tools') {
      response = await handleToolExecute(req);
    } else if (method === 'POST' && pathname.startsWith('/tools/')) {
      const toolName = pathname.substring('/tools/'.length);
      response = await handleToolExecuteByPath(toolName, req);
    } else if (method === 'POST' && pathname === '/') {
      response = await handleMCP(req);
    } else {
      response = handle404(pathname);
    }

    const finalResponse = addCorsHeaders(response);
    logRequest(method, pathname, finalResponse.status, Date.now() - startTime);
    return finalResponse;

  } catch (error) {
    console.error('Request error:', error);
    const errorResponse = Response.json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
    const finalResponse = addCorsHeaders(errorResponse);
    logRequest(method, pathname, 500, Date.now() - startTime);
    return finalResponse;
  }
}

// ============================================================================
// Server Lifecycle
// ============================================================================

/**
 * Initialize the progressive disclosure tier system
 */
async function initializeTierSystem(): Promise<void> {
  if (!TIER_SYSTEM_CONFIG.enabled) {
    console.log('⚠️  Tier system disabled - skipping initialization');
    return;
  }

  console.log('🔧 Initializing Progressive Disclosure Tier System...');

  try {
    // Initialize MCP Client Manager
    console.log(`📡 Connecting to ${TIER_SYSTEM_CONFIG.mcpServers.length} MCP servers...`);
    const mcpClientManager = new MCPClientManager(TIER_SYSTEM_CONFIG.mcpServers);
    await mcpClientManager.initialize();

    // Initialize Agent Config Loader
    console.log(`🤖 Loading agent configurations from ${TIER_SYSTEM_CONFIG.agentServer.url}...`);
    const agentLoader = new AgentConfigLoader(
      TIER_SYSTEM_CONFIG.agentServer.url,
      TIER_SYSTEM_CONFIG.agentServer.bearerToken
    );
    await agentLoader.loadAgents();

    // Create Tier Tools Manager
    tierToolsManager = new TierToolsManager(agentLoader, mcpClientManager);

    console.log('✅ Tier system initialized successfully');
    console.log(`   📊 MCP servers: ${mcpClientManager.getServerHealth().filter(s => s.healthy).length}/${TIER_SYSTEM_CONFIG.mcpServers.length} healthy`);
    console.log(`   🤖 Agents loaded: ${agentLoader.listAgents().length}`);
    console.log(`   🛠️  Tier tools: ${tierToolsManager.getTierToolNames().length}`);
  } catch (error) {
    console.error('❌ Failed to initialize tier system:', error);
    console.log('⚠️  Server will start without tier tools');
    tierToolsManager = null;
  }
}

/**
 * Start the HTTP server
 */
async function startServer(): Promise<void> {
  console.log('🌐 Starting Ailumina Bridge HTTP Server...');

  // Initialize tier system first
  await initializeTierSystem();

  Bun.serve({
    port: AILUMINA_HTTP_CONFIG.port,
    hostname: AILUMINA_HTTP_CONFIG.host,
    fetch: handleRequest,
  });

  console.log(`🌐 Ailumina Bridge HTTP Server listening on http://${AILUMINA_HTTP_CONFIG.host}:${AILUMINA_HTTP_CONFIG.port}`);
  console.log(`🔐 Authentication: ${AILUMINA_HTTP_CONFIG.auth.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`🎯 Tier System: ${TIER_SYSTEM_CONFIG.enabled && tierToolsManager ? 'Enabled' : 'Disabled'}`);
  console.log('✅ Ailumina Bridge HTTP Server started successfully');
  console.log('🛠️  Available endpoints: /health, /tools');
  console.log('🌐 Ready for AI communication via HTTP');
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down Ailumina Bridge HTTP Server...`);
  process.exit(0);
}

// ============================================================================
// Entry Point
// ============================================================================

// Setup graceful shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
startServer().catch((error) => {
  console.error('❌ Failed to start Ailumina Bridge HTTP Server:', error);
  process.exit(1);
});
