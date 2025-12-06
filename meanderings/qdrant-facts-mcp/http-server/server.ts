/**
 * Bun native HTTP server for Qdrant Facts HTTP transport
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { FACTS_HTTP_CONFIG } from './config/settings.js';
import { FACTS_OAUTH_CONFIG } from './config/oauth-config.js';
import { toolRegistry } from '../shared/tools/index.js';

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
  const cacheExpired = now - jwksCacheTime > FACTS_OAUTH_CONFIG.jwt.jwksCacheTtl * 1000;

  if (!jwksCache || cacheExpired) {
    const authServer = FACTS_OAUTH_CONFIG.authorizationServers[0];
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
    const cacheExpired = age > FACTS_OAUTH_CONFIG.jwt.tokenCacheTtl * 1000;

    if (!cacheExpired && cached.session.exp * 1000 > Date.now()) {
      console.log("[OAuth] Token cache hit");
      return cached.session;
    }
    tokenCache.delete(token);
  }

  try {
    const jwks = getJWKS();

    const { payload } = await jwtVerify(token, jwks, {
      issuer: FACTS_OAUTH_CONFIG.oauthIssuer,
      audience: FACTS_OAUTH_CONFIG.resourceId,
      clockTolerance: FACTS_OAUTH_CONFIG.jwt.clockTolerance,
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

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  if (FACTS_HTTP_CONFIG.cors.enabled) {
    // Use configured origins or fallback to '*'
    const origin = FACTS_HTTP_CONFIG.cors.origins.includes('*')
      ? '*'
      : FACTS_HTTP_CONFIG.cors.origins.join(',');

    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Validate authentication (skip for public endpoints)
 * Supports OAuth JWT validation with fallback to bearer token
 */
async function validateAuth(req: Request, pathname: string): Promise<Response | null> {
  // Public endpoints and well-known endpoints
  if (pathname === '/health' || pathname === '/' || pathname === '/.well-known/oauth-protected-resource') {
    return null;
  }

  const authHeader = req.headers.get('Authorization');

  // Try OAuth JWT validation first if enabled
  if (FACTS_OAUTH_CONFIG.enabled && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = await validateJWT(token);

    if (session) {
      // OAuth JWT validation successful
      return null;
    }

    // JWT validation failed, try bearer token fallback
  }

  // Skip auth if disabled
  if (!FACTS_HTTP_CONFIG.auth.enabled) {
    return null;
  }

  if (!authHeader) {
    return Response.json(
      { error: 'Unauthorized', message: 'Missing Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== FACTS_HTTP_CONFIG.auth.token) {
    return Response.json(
      { error: 'Unauthorized', message: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  return null;
}

/**
 * Check Qdrant health
 */
async function checkQdrantHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${FACTS_HTTP_CONFIG.qdrant.url}/healthz`);
    return response.ok;
  } catch (error) {
    console.error('Qdrant health check failed:', error);
    return false;
  }
}

/**
 * Health check endpoint handler
 */
async function handleHealth(): Promise<Response> {
  try {
    const qdrantHealthy = await checkQdrantHealth();

    const status = {
      status: qdrantHealthy ? 'healthy' : 'degraded',
      service: 'qdrant-facts-mcp-server',
      version: '1.0.0',
      qdrant: {
        url: FACTS_HTTP_CONFIG.qdrant.url,
        status: qdrantHealthy ? 'connected' : 'disconnected'
      },
      timestamp: new Date().toISOString()
    };

    return Response.json(status, { status: qdrantHealthy ? 200 : 503 });
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Root endpoint info handler
 */
function handleRoot(): Response {
  return Response.json({
    service: 'qdrant-facts-mcp-server',
    version: '1.0.0',
    description: 'External facts pool via MCP over HTTP',
    philosophy: 'External knowledge (unverified) separate from internal observations (verified)',
    protocolVersion: '2024-11-05',
    architecture: 'dual-transport',
    transport: 'MCP-over-HTTP',
    sampling: 'Not supported (use STDIO wrapper)',
    endpoints: {
      mcp: 'POST / (JSON-RPC 2.0)',
      tools: 'GET /tools (list), POST /tools/{name} (execute)',
      health: 'GET /health'
    },
    capabilities: {
      tools: ['search_facts', 'get_fact', 'add_fact', 'mark_verified', 'list_collections'],
      resources: [],
      sampling: false
    },
    linking: {
      direction: 'Neo4j → Qdrant (consciousness references facts)',
      forbidden: 'Qdrant → Neo4j (facts do not contaminate consciousness)'
    }
  });
}

/**
 * List tools endpoint handler
 */
function handleToolsList(): Response {
  const tools = toolRegistry.listTools();
  return Response.json({
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  });
}

/**
 * OAuth 2.1 Protected Resource Metadata endpoint (RFC 9728)
 */
function handleProtectedResourceMetadata(): Response {
  const metadata = {
    resource: FACTS_OAUTH_CONFIG.resourceId,
    authorization_servers: FACTS_OAUTH_CONFIG.authorizationServers,
    scopes_supported: FACTS_OAUTH_CONFIG.supportedScopes,
    bearer_methods_supported: FACTS_OAUTH_CONFIG.bearerMethodsSupported,
    resource_documentation: `${FACTS_OAUTH_CONFIG.resourceId}/docs`,
    resource_signing_alg_values_supported: ["RS256"],
  };

  return Response.json(metadata);
}

/**
 * Execute tool endpoint handler
 */
async function handleToolExecution(toolName: string, req: Request): Promise<Response> {
  try {
    const body = await req.json() as { parameters?: any };
    const { parameters = {} } = body;

    const tool = toolRegistry.getTool(toolName);
    if (!tool) {
      return Response.json({
        error: 'Tool not found',
        tool: toolName,
        available: toolRegistry.listTools().map(t => t.name)
      }, { status: 404 });
    }

    const result = await tool.handler(parameters);
    return Response.json(result);
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error);
    return Response.json({
      error: 'Tool execution failed',
      tool: toolName,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * MCP JSON-RPC 2.0 endpoint handler
 */
async function handleMcpRequest(req: Request): Promise<Response> {
  try {
    const body = await req.json() as { jsonrpc?: string; method?: string; params?: any; id?: string | number };
    const { jsonrpc, method, params, id } = body;

    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== '2.0') {
      return Response.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'jsonrpc version must be "2.0"'
        },
        id: id || null
      }, { status: 400 });
    }

    switch (method) {
      case 'initialize': {
        return Response.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'qdrant-facts-mcp-server',
              version: '1.0.0'
            }
          },
          id
        });
      }

      case 'notifications/initialized': {
        // Acknowledge initialization notification (no response needed for notifications)
        return Response.json({
          jsonrpc: '2.0',
          result: {},
          id
        });
      }

      case 'tools/list': {
        const tools = toolRegistry.listTools();
        return Response.json({
          jsonrpc: '2.0',
          result: {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          },
          id
        });
      }

      case 'tools/call': {
        const { name: toolName, arguments: toolArgs = {} } = params || {};

        if (!toolName) {
          return Response.json({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Invalid params',
              data: 'Tool name is required'
            },
            id
          }, { status: 400 });
        }

        const tool = toolRegistry.getTool(toolName);
        if (!tool) {
          return Response.json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: 'Method not found',
              data: `Tool "${toolName}" not found`
            },
            id
          }, { status: 404 });
        }

        const result = await tool.handler(toolArgs);
        return Response.json({
          jsonrpc: '2.0',
          result,
          id
        });
      }

      default: {
        return Response.json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Method "${method}" not supported`
          },
          id
        }, { status: 404 });
      }
    }
  } catch (error) {
    console.error('MCP request error:', error);
    return Response.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      },
      id: null
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
      'POST / (MCP JSON-RPC 2.0)',
      'GET /health',
      'GET /tools',
      'POST /tools/{name}'
    ]
  }, { status: 404 });
}

/**
 * Request logging helper
 */
function logRequest(method: string, pathname: string, statusCode: number, duration: number): void {
  const statusColor = statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
  const reset = '\x1b[0m';
  console.log(`${statusColor}${statusCode}${reset} ${method} ${pathname} - ${duration}ms`);
}

/**
 * Main request router
 */
async function handleRequest(req: Request): Promise<Response> {
  const start = Date.now();
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      const response = new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': FACTS_HTTP_CONFIG.cors.enabled
            ? (FACTS_HTTP_CONFIG.cors.origins.includes('*') ? '*' : FACTS_HTTP_CONFIG.cors.origins.join(','))
            : '',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
      logRequest(method, pathname, 204, Date.now() - start);
      return response;
    }

    // Validate authentication
    const authError = await validateAuth(req, pathname);
    if (authError) {
      const finalResponse = addCorsHeaders(authError);
      logRequest(method, pathname, 401, Date.now() - start);
      return finalResponse;
    }

    // Route to handlers
    let response: Response;

    if (method === 'GET' && pathname === '/health') {
      response = await handleHealth();
    } else if (method === 'GET' && pathname === '/') {
      response = handleRoot();
    } else if (method === 'GET' && pathname === '/.well-known/oauth-protected-resource') {
      response = handleProtectedResourceMetadata();
    } else if (method === 'GET' && pathname === '/tools') {
      response = handleToolsList();
    } else if (method === 'POST' && pathname.startsWith('/tools/')) {
      const toolName = pathname.substring('/tools/'.length);
      response = await handleToolExecution(toolName, req);
    } else if (method === 'POST' && pathname === '/') {
      response = await handleMcpRequest(req);
    } else {
      response = handle404(pathname);
    }

    const finalResponse = addCorsHeaders(response);
    logRequest(method, pathname, finalResponse.status, Date.now() - start);
    return finalResponse;
  } catch (error) {
    console.error('Request error:', error);
    const errorResponse = Response.json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
    const finalResponse = addCorsHeaders(errorResponse);
    logRequest(method, pathname, 500, Date.now() - start);
    return finalResponse;
  }
}

export class FactsHttpServer {
  private server?: any;

  async start(): Promise<void> {
    this.server = Bun.serve({
      port: FACTS_HTTP_CONFIG.port,
      hostname: FACTS_HTTP_CONFIG.host,
      fetch: handleRequest,
    });

    console.log(`📦 Qdrant Facts HTTP Server listening on http://${FACTS_HTTP_CONFIG.host}:${FACTS_HTTP_CONFIG.port}`);
    console.log(`🔐 Authentication: ${FACTS_HTTP_CONFIG.auth.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`🔗 Qdrant: ${FACTS_HTTP_CONFIG.qdrant.url}`);
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      console.log('📦 Qdrant Facts HTTP Server stopped');
    }
  }
}
