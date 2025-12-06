/**
 * HTTP Server entry point for ai-recall-mcp - Bun Native HTTP
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { RECALL_OAUTH_CONFIG } from './config/oauth-config.js';
import { RECALL_TOOLS } from '../shared/tools/index.js';
import type { QdrantConfig } from '../shared/types.js';

// Environment configuration
const PORT = parseInt(process.env.RECALL_HTTP_PORT || '3006', 10);
const HOST = process.env.RECALL_HTTP_HOST || '0.0.0.0';
const CORS_ORIGINS = process.env.RECALL_CORS_ORIGINS?.split(',') || ['*'];
const AUTH_ENABLED = process.env.RECALL_AUTH_ENABLED === 'true';
const AUTH_TOKEN = process.env.RECALL_AUTH_TOKEN || 'recall-research-key-12345';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'conversation-turns';

// Qdrant configuration for tool execution
const qdrantConfig: QdrantConfig = {
  url: QDRANT_URL,
  collection: QDRANT_COLLECTION,
};

/**
 * OAuth JWT validation types and caches
 */
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
  const cacheExpired = now - jwksCacheTime > RECALL_OAUTH_CONFIG.jwt.jwksCacheTtl * 1000;

  if (!jwksCache || cacheExpired) {
    const authServer = RECALL_OAUTH_CONFIG.authorizationServers[0];
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
    const cacheExpired = age > RECALL_OAUTH_CONFIG.jwt.tokenCacheTtl * 1000;

    if (!cacheExpired && cached.session.exp * 1000 > Date.now()) {
      console.log("[OAuth] Token cache hit");
      return cached.session;
    }
    tokenCache.delete(token);
  }

  try {
    const jwks = getJWKS();

    const { payload } = await jwtVerify(token, jwks, {
      issuer: RECALL_OAUTH_CONFIG.oauthIssuer,
      audience: RECALL_OAUTH_CONFIG.resourceId,
      clockTolerance: RECALL_OAUTH_CONFIG.jwt.clockTolerance,
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

// MCP Protocol types
interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Credentials', 'true');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Validate authentication (skip for /health endpoint)
 * Supports OAuth JWT validation with fallback to bearer token
 */
async function validateAuth(req: Request, pathname: string): Promise<Response | null> {
  // Skip auth for health check and well-known endpoints
  if (pathname === '/health' || pathname === '/.well-known/oauth-protected-resource') {
    return null;
  }

  const authHeader = req.headers.get('Authorization');

  // Try OAuth JWT validation first if enabled
  if (RECALL_OAUTH_CONFIG.enabled && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = await validateJWT(token);

    if (session) {
      // OAuth JWT validation successful
      return null;
    }

    // JWT validation failed, try bearer token fallback
  }

  // Skip auth if disabled
  if (!AUTH_ENABLED) {
    return null;
  }

  if (!authHeader) {
    return Response.json(
      {
        error: 'Missing Authorization header',
        message: 'Bearer token required for Recall system access'
      },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== AUTH_TOKEN) {
    return Response.json(
      {
        error: 'Invalid token',
        message: 'Invalid bearer token for Recall system'
      },
      { status: 401 }
    );
  }

  return null;
}

/**
 * Root endpoint handler
 */
function handleRoot(): Response {
  return Response.json({
    service: 'ai-recall-mcp',
    version: '1.0.0',
    description: 'Conversation history recall with semantic search over Qdrant',
    protocolVersion: '2024-11-05',
    architecture: 'dual-transport',
    transport: 'MCP-over-HTTP',
    endpoints: {
      mcp: 'POST /mcp (JSON-RPC 2.0)',
      health: 'GET /health'
    },
    capabilities: {
      tools: ['get_schema', 'semantic_search', 'text_search', 'system_status'],
      resources: [],
      sampling: false
    },
    qdrant: {
      collection: QDRANT_COLLECTION,
      vectorDimensions: 1024,
      embeddingModel: 'multilingual-e5-large'
    }
  });
}

/**
 * Health check endpoint handler
 */
function handleHealth(): Response {
  return Response.json({
    status: 'healthy',
    service: 'ai-recall-mcp',
    description: 'Conversation history recall with semantic search',
    qdrant: {
      url: QDRANT_URL,
      collection: QDRANT_COLLECTION,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * OAuth 2.1 Protected Resource Metadata endpoint (RFC 9728)
 */
function handleProtectedResourceMetadata(): Response {
  const metadata = {
    resource: RECALL_OAUTH_CONFIG.resourceId,
    authorization_servers: RECALL_OAUTH_CONFIG.authorizationServers,
    scopes_supported: RECALL_OAUTH_CONFIG.supportedScopes,
    bearer_methods_supported: RECALL_OAUTH_CONFIG.bearerMethodsSupported,
    resource_documentation: `${RECALL_OAUTH_CONFIG.resourceId}/docs`,
    resource_signing_alg_values_supported: ["RS256"],
  };

  return Response.json(metadata);
}

/**
 * MCP initialize method handler
 */
function handleInitialize(id: string | number | null): MCPResponse {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo: {
        name: 'recall-conversation-history',
        version: '1.0.0',
        description: 'Conversation history recall system with semantic search over Qdrant vector database'
      }
    }
  };
}

/**
 * MCP tools/list method handler
 */
function handleToolsList(id: string | number | null): MCPResponse {
  const tools = [
    {
      name: 'get_schema',
      description: 'View collection schema and metadata - Call first to understand available filters and search capabilities',
      inputSchema: {
        type: 'object',
        properties: {
          include_statistics: {
            type: 'boolean',
            description: 'Include collection statistics (total turns, indexed vectors)',
            default: true
          }
        }
      }
    },
    {
      name: 'semantic_search',
      description: 'Semantic search over conversation history - Find relevant past conversations by meaning',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query text (will be embedded automatically)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10
          },
          threshold: {
            type: 'number',
            description: 'Minimum similarity score (0.0-1.0)',
            default: 0.7
          },
          filters: {
            type: 'object',
            description: 'Optional filters: provider, date_time range, role, etc.',
            additionalProperties: true
          }
        },
        required: ['query']
      }
    },
    {
      name: 'text_search',
      description: 'Keyword-based metadata search - Search by exact text in conversation metadata',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Text query to search for in metadata'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 10
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to search (text, conversation_title, provider, etc.)'
          },
          provider: {
            type: 'string',
            description: 'Filter by AI provider (chatgpt, claude, OpenAI)'
          },
          date_from: {
            type: 'string',
            description: 'Start date (ISO 8601 format)'
          },
          date_to: {
            type: 'string',
            description: 'End date (ISO 8601 format)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'system_status',
      description: 'Check Recall system health - Verify Qdrant connection and collection status',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  return {
    jsonrpc: '2.0',
    id,
    result: {
      tools
    }
  };
}

/**
 * MCP tools/call method handler
 */
async function handleToolsCall(id: string | number | null, params: any): Promise<MCPResponse> {
  const { name, arguments: args } = params || {};

  if (!name) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: 'Invalid params',
        data: 'Tool name is required'
      }
    };
  }

  const tool = RECALL_TOOLS[name as keyof typeof RECALL_TOOLS];
  if (!tool) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: 'Invalid params',
        data: `Tool '${name}' not found`
      }
    };
  }

  try {
    const result = await tool.execute(qdrantConfig, args || {});
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: 'Tool execution failed',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * MCP JSON-RPC request handler
 */
async function handleMCP(req: Request): Promise<Response> {
  try {
    const request = await req.json() as MCPRequest;

    // Validate JSON-RPC format
    if (!request || request.jsonrpc !== '2.0') {
      return Response.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Request must be a valid JSON-RPC 2.0 message'
        }
      }, { status: 400 });
    }

    const requestId = request.id ?? null;
    let response: MCPResponse;

    switch (request.method) {
      case 'initialize':
        response = handleInitialize(requestId);
        break;

      case 'tools/list':
        response = handleToolsList(requestId);
        break;

      case 'tools/call':
        response = await handleToolsCall(requestId, request.params);
        break;

      default:
        response = {
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32601,
            message: 'Method not found',
            data: { method: request.method }
          }
        };
    }

    return Response.json(response);
  } catch (error) {
    console.error('MCP Route Error:', error);
    return Response.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

/**
 * 404 handler
 */
function handle404(pathname: string): Response {
  return Response.json({
    error: 'Not Found',
    path: pathname,
    available_endpoints: [
      'GET / (server info)',
      'POST /mcp (MCP JSON-RPC 2.0)',
      'GET /health'
    ]
  }, { status: 404 });
}

/**
 * Main request router
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Validate authentication
  const authError = await validateAuth(req, pathname);
  if (authError) {
    return addCorsHeaders(authError);
  }

  // Route to handlers
  try {
    let response: Response;

    if (method === 'GET' && pathname === '/') {
      response = handleRoot();
    } else if (method === 'GET' && pathname === '/health') {
      response = handleHealth();
    } else if (method === 'GET' && pathname === '/.well-known/oauth-protected-resource') {
      response = handleProtectedResourceMetadata();
    } else if (method === 'POST' && pathname === '/mcp') {
      response = await handleMCP(req);
    } else {
      response = handle404(pathname);
    }

    return addCorsHeaders(response);
  } catch (error) {
    console.error('Request error:', error);
    return addCorsHeaders(Response.json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 }));
  }
}

// Start server
console.log('💭 Starting Recall HTTP Server...');

Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch: handleRequest,
});

console.log(`💭 Recall HTTP Server listening on http://${HOST}:${PORT}`);
console.log(`🔐 Authentication: ${AUTH_ENABLED ? 'Enabled' : 'Disabled'}`);
console.log(`📚 Qdrant: ${QDRANT_URL} (${QDRANT_COLLECTION})`);
console.log(`📍 Endpoints:`);
console.log(`   GET  /         - Service info`);
console.log(`   GET  /health   - Health check`);
console.log(`   POST /mcp      - MCP JSON-RPC 2.0`);
console.log('💭 Server ready!');
