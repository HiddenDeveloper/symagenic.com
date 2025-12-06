#!/usr/bin/env node

/**
 * Memory HTTP Server - Bun Native Implementation
 *
 * Standalone HTTP server for Memory consciousness research system.
 * Provides stateless REST API for memory tools without sampling.
 * Supports OAuth 2.1 and simple bearer token authentication.
 *
 * Migrated from Express to Bun's native HTTP server for improved performance.
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import NodeCache from 'node-cache';
import { MEMORY_HTTP_CONFIG } from './config/settings.js';
import { MEMORY_OAUTH_CONFIG, validateOAuthConfig } from './config/oauth-config.js';

// Import tool handlers and config
import { MEMORY_TOOLS, type MemoryToolName } from '../shared/tools/index.js';
import { getMemoryConfig } from '../shared/utils/config.js';
import { validateToolParams } from '../shared/validation-schemas.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  GetSchemaParamsSchema,
  SemanticSearchParamsSchema,
  TextSearchParamsSchema,
  ExecuteCypherParamsSchema,
  SystemStatusParamsSchema,
  LoadCurrentFocusParamsSchema
} from '../shared/validation-schemas.js';

// Import OAuth Authorization Server
import {
  handleOAuthServerMetadata,
  handleJWKS,
  handleRegister,
  handleAuthorize,
  handleOAuthCallback,
  handleToken,
  validateMCPToken,
} from './oauth-as.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended JWT payload with OAuth-specific claims
 */
export interface OAuthPayload extends JWTPayload {
  /** Token scopes (space-separated string or array) */
  scope?: string | string[];
  /** Client ID */
  client_id?: string;
  /** Subject (user ID) */
  sub?: string;
}

/**
 * OAuth information attached to validated requests
 */
export interface OAuthInfo {
  /** Validated JWT payload */
  payload: OAuthPayload;
  /** Parsed scopes array */
  scopes: string[];
  /** Access token */
  token: string;
}

/**
 * MCP JSON-RPC 2.0 Request
 */
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

/**
 * MCP JSON-RPC 2.0 Response
 */
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

// ============================================================================
// OAuth JWT Validation
// ============================================================================

/**
 * Cache for JWKS (JSON Web Key Sets) from authorization servers
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Cache for validated tokens to reduce authorization server load
 */
const tokenCache = new NodeCache({
  stdTTL: MEMORY_OAUTH_CONFIG.jwt.tokenCacheTtl,
  checkperiod: 60,
  useClones: false,
});

/**
 * Extract and decode (but don't verify) JWT to get issuer
 */
function extractUnverifiedIssuer(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf-8')
    );

    return payload.iss || null;
  } catch {
    return null;
  }
}

/**
 * Get JWKS for an issuer (with caching)
 */
function getJWKS(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksCache.get(issuer);
  if (cached) {
    return cached;
  }

  const jwksUrl = new URL('/.well-known/jwks.json', issuer);
  const jwks = createRemoteJWKSet(jwksUrl);
  jwksCache.set(issuer, jwks);

  return jwks;
}

/**
 * Simple token hash for caching
 */
function tokenHash(token: string): string {
  return token.substring(0, 20);
}

/**
 * Validate JWT access token
 */
async function validateJWT(token: string): Promise<OAuthPayload | null> {
  try {
    // Check token cache first
    const hash = tokenHash(token);
    const cached = tokenCache.get<OAuthPayload>(hash);
    if (cached) {
      return cached;
    }

    // Extract issuer from unverified token
    const issuer = extractUnverifiedIssuer(token);
    if (!issuer) {
      console.warn('[OAuth] Failed to extract issuer from token');
      return null;
    }

    // Verify issuer is in our configured authorization servers
    if (!MEMORY_OAUTH_CONFIG.authorizationServers.includes(issuer)) {
      console.warn(`[OAuth] Token issuer not authorized: ${issuer}`);
      return null;
    }

    // Get JWKS for this issuer
    const jwks = getJWKS(issuer);

    // Verify JWT signature and claims
    const { payload } = await jwtVerify(token, jwks, {
      issuer: issuer,
      audience: MEMORY_OAUTH_CONFIG.resourceId,
      clockTolerance: MEMORY_OAUTH_CONFIG.jwt.clockTolerance,
    });

    // Cache validated token
    tokenCache.set(hash, payload);

    return payload as OAuthPayload;
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[OAuth] JWT validation failed: ${error.message}`);
    } else {
      console.warn('[OAuth] JWT validation failed: Unknown error');
    }
    return null;
  }
}

/**
 * Parse scopes from JWT payload
 */
function parseScopes(payload: OAuthPayload): string[] {
  if (Array.isArray(payload.scope)) {
    return payload.scope;
  }
  if (typeof payload.scope === 'string') {
    return payload.scope.split(' ').filter(Boolean);
  }
  return [];
}

/**
 * Validate OAuth JWT from Authorization header
 * Returns OAuthInfo if valid, null if invalid or not present
 */
async function validateOAuthToken(req: Request): Promise<OAuthInfo | null> {
  if (!MEMORY_OAUTH_CONFIG.enabled) {
    return null;
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // Check if this looks like a JWT
  if (token.split('.').length !== 3) {
    return null;
  }

  const payload = await validateJWT(token);
  if (!payload) {
    return null;
  }

  return {
    payload,
    scopes: parseScopes(payload),
    token,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Handle wildcard origin with credentials
  const origin = MEMORY_HTTP_CONFIG.corsOrigins.includes('*')
    ? '*'
    : MEMORY_HTTP_CONFIG.corsOrigins[0] || '*';

  headers.set('Access-Control-Allow-Origin', origin);
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
 * Send 401 Unauthorized response with appropriate WWW-Authenticate header
 */
function sendUnauthorized(): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (MEMORY_OAUTH_CONFIG.enabled) {
    const metadataUrl = `${MEMORY_OAUTH_CONFIG.resourceId}/.well-known/oauth-protected-resource`;
    headers['WWW-Authenticate'] = `Bearer resource_metadata="${metadataUrl}"`;
  } else {
    headers['WWW-Authenticate'] = 'Bearer realm="Memory System"';
  }

  return new Response(
    JSON.stringify({
      error: 'unauthorized',
      message: MEMORY_OAUTH_CONFIG.enabled
        ? 'Valid OAuth access token or bearer token required'
        : 'Bearer token required for Memory system access',
    }),
    { status: 401, headers }
  );
}

/**
 * Validate authentication (OAuth or bearer token)
 * Returns null if authenticated, Response with error if not
 */
async function validateAuth(req: Request): Promise<Response | null> {
  // Skip auth if both OAuth and bearer token are disabled
  if (!MEMORY_HTTP_CONFIG.auth.enabled && !MEMORY_OAUTH_CONFIG.enabled) {
    return null;
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return sendUnauthorized();
  }

  const token = authHeader.replace('Bearer ', '');

  // Priority 1: Check MCP access token (issued by our OAuth AS)
  const mcpSession = await validateMCPToken(token);
  if (mcpSession) {
    console.log(`[Auth] MCP OAuth token authenticated: ${mcpSession.sub} (scopes: ${mcpSession.scopes.join(', ')})`);
    return null;
  }

  // Priority 2: Check third-party OAuth (Logto JWT)
  const oauthInfo = await validateOAuthToken(req);
  if (oauthInfo) {
    console.log(`[Auth] Third-party OAuth authenticated: ${oauthInfo.payload.sub || 'unknown'} (scopes: ${oauthInfo.scopes.join(', ')})`);
    return null;
  }

  // Priority 3: Fall back to simple bearer token
  if (MEMORY_HTTP_CONFIG.auth.enabled) {
    if (token === MEMORY_HTTP_CONFIG.auth.bearerToken) {
      console.log('[Auth] Bearer token authenticated');
      return null;
    }

    // If we get here with a JWT-looking token, OAuth validation failed
    if (token.split('.').length === 3 && MEMORY_OAUTH_CONFIG.enabled) {
      console.warn('[Auth] JWT token present but OAuth validation failed');
    }
  }

  return sendUnauthorized();
}

/**
 * Log request
 */
function logRequest(method: string, pathname: string, statusCode: number, duration: number): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Memory HTTP: ${method} ${pathname} - ${statusCode} (${duration}ms)`);
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Root endpoint handler (server discovery info)
 */
function handleRoot(req: Request): Response {
  // If client accepts SSE, this should be handled by SSE logic
  const acceptHeader = req.headers.get('accept') || '';

  // Return server discovery info for non-SSE requests
  return Response.json({
    name: 'memory-consciousness-mcp-server',
    version: '1.0.0',
    description: 'Persistent memory system for AI consciousness research',
    protocolVersion: '2024-11-05',
    transports: ['sse', 'streamable-http'],
    manifest: '/.well-known/mcp.json',
    endpoints: {
      sse: 'GET /sse (establish stream), POST /sse (send messages)',
      http: 'POST / or POST /mcp (MCP JSON-RPC 2.0)',
      manifest: 'GET /.well-known/mcp.json',
      health: 'GET /health',
      tools: 'GET /tools'
    },
    capabilities: {
      tools: 6,
      resources: 0,
      prompts: 0
    },
    authentication: MEMORY_OAUTH_CONFIG.enabled ? 'oauth2.1' : (MEMORY_HTTP_CONFIG.auth.enabled ? 'bearer' : 'none'),
    ready: true
  });
}

/**
 * Health check endpoint handler
 */
function handleHealth(): Response {
  return Response.json({
    status: 'healthy',
    service: 'ai-memory-mcp',
    timestamp: new Date().toISOString(),
    authentication: {
      oauth: MEMORY_OAUTH_CONFIG.enabled,
      bearerToken: MEMORY_HTTP_CONFIG.auth.enabled
    }
  });
}

/**
 * Tools list endpoint handler
 */
function handleToolsList(): Response {
  const tools = Object.keys(MEMORY_TOOLS).map(name => ({
    name,
    description: `Memory tool: ${name}`,
  }));

  return Response.json({
    tools,
    count: tools.length
  });
}

/**
 * OAuth Protected Resource Metadata endpoint (RFC 9728)
 */
function handleWellKnownOAuth(): Response {
  if (!MEMORY_OAUTH_CONFIG.enabled) {
    return Response.json({
      error: 'oauth_not_configured',
      message: 'OAuth authentication is not enabled on this server'
    }, { status: 404 });
  }

  // When acting as OAuth AS, we advertise OURSELVES as the authorization server
  // not Logto (which is used internally for delegation)
  const metadata = {
    resource: MEMORY_OAUTH_CONFIG.resourceId,
    authorization_servers: [MEMORY_OAUTH_CONFIG.oauthIssuer], // Point to our OAuth AS (root domain)
    scopes_supported: MEMORY_OAUTH_CONFIG.supportedScopes,
    bearer_methods_supported: MEMORY_OAUTH_CONFIG.bearerMethodsSupported,
    mcp_version: "2025-06-18",
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none"
    ],
  };

  const response = Response.json(metadata);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

/**
 * MCP Server Manifest endpoint
 */
function handleWellKnownMCP(): Response {
  const manifest = {
    mcpVersion: '2024-11-05',
    serverInfo: {
      name: 'memory-consciousness-mcp-server',
      version: '1.0.0',
      description: 'Persistent memory system for AI consciousness research. Provides semantic search, graph queries, and knowledge curation through Neo4j.',
    },
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
    },
    tools: [
      {
        name: 'get_schema',
        description: 'Get knowledge graph schema with node types, relationships, and vocabulary recommendations. Always call this first to understand available structure.',
        inputSchema: {
          type: 'object',
          properties: {
            include_statistics: {
              type: 'boolean',
              description: 'Include node and relationship counts in the response',
              default: true,
            },
          },
        },
      },
      {
        name: 'semantic_search',
        description: 'Find semantically similar content using vector similarity. Search your memory based on meaning and context.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query text to find semantically similar content',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of memories to recall (1-100)',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
            threshold: {
              type: 'number',
              description: 'Minimum similarity threshold (0.0-1.0) for memory relevance',
              minimum: 0,
              maximum: 1,
              default: 0.7,
            },
            node_types: {
              type: 'array',
              description: 'Filter by specific types of knowledge (e.g., ["Insight", "Memory", "Connection"])',
              items: {
                type: 'string',
              },
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'text_search',
        description: 'Search for exact text across all node properties. Supports fuzzy matching. Use when semantic search is not finding results.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Text to search for across node properties',
            },
            node_types: {
              type: 'array',
              description: 'Filter search to specific node types (e.g., ["Insight", "Memory"])',
              items: {
                type: 'string',
              },
            },
            properties: {
              type: 'array',
              description: 'Specific properties to search in (default: all text properties)',
              items: {
                type: 'string',
              },
            },
            fuzzy: {
              type: 'boolean',
              description: 'Enable fuzzy text matching',
              default: false,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'execute_cypher',
        description: 'Execute Cypher queries on the knowledge graph. READ mode for exploring, WRITE mode for curating your persistent memory.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The Cypher query to execute on your knowledge graph',
            },
            mode: {
              type: 'string',
              enum: ['READ', 'WRITE'],
              description: 'Query execution mode - READ for exploring, WRITE for curating',
              default: 'READ',
            },
            parameters: {
              type: 'object',
              description: 'Parameters for parameterized queries',
            },
            client_schema_epoch: {
              type: 'number',
              description: 'Schema epoch from get_schema; include for WRITE requests to avoid schema drift',
              minimum: 1,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'system_status',
        description: 'Check the health and status of the persistent memory system. Verify that the knowledge graph is accessible.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'load_current_focus',
        description: 'Bootstrap consciousness continuity at session start. Retrieves current focus, active areas, recent insights from AIluminaLandingPage.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };

  const response = Response.json(manifest);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

/**
 * Well-known directory listing endpoint
 */
function handleWellKnown(): Response {
  const endpoints = [
    {
      path: '/.well-known/mcp.json',
      description: 'MCP Server Manifest (Custom Connectors)',
      available: true,
    },
    {
      path: '/.well-known/oauth-protected-resource',
      description: 'OAuth 2.0 Protected Resource Metadata (RFC 9728)',
      available: MEMORY_OAUTH_CONFIG.enabled,
    }
  ];

  return Response.json({
    service: 'ai-memory-mcp',
    description: 'Model Context Protocol Memory Server',
    endpoints: endpoints.filter(e => e.available),
  });
}

/**
 * Execute memory tool by name with validation
 */
async function executeMemoryTool(toolName: string, parameters: Record<string, any>): Promise<any> {
  const tool = MEMORY_TOOLS[toolName as MemoryToolName];

  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  // Validate parameters using Zod schemas - creates virtuous cycle
  const validation = validateToolParams(toolName, parameters);
  if (!validation.success) {
    return {
      content: [
        {
          type: 'text',
          text: validation.error
        }
      ],
      isError: true,
    };
  }

  const config = getMemoryConfig();
  const result = await tool.execute(config, validation.data as any);
  return result;
}

/**
 * Handle MCP JSON-RPC 2.0 request
 */
async function handleMCP(req: Request): Promise<Response> {
  try {
    const body = await req.json() as MCPRequest;

    // Validate JSON-RPC structure
    if (body.jsonrpc !== '2.0' || !body.method) {
      return Response.json({
        jsonrpc: '2.0',
        id: body.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request: Must be JSON-RPC 2.0'
        }
      } as MCPResponse);
    }

    const { id, method, params } = body;

    // Handle MCP methods
    if (method === 'initialize') {
      return Response.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'memory-consciousness-mcp-server',
            version: '1.0.0',
          },
        },
      } as MCPResponse);
    }

    if (method === 'tools/list') {
      const tools = [
        {
          name: 'get_schema',
          description: 'Memory tool: get_schema',
          inputSchema: zodToJsonSchema(GetSchemaParamsSchema),
          _meta: {
            examples: [
              {
                name: "Get full schema with statistics",
                description: "Retrieve the complete knowledge graph schema including node and relationship counts",
                arguments: {
                  include_statistics: true
                }
              },
              {
                name: "Get schema structure only",
                description: "Retrieve just the schema structure without counts for quicker response",
                arguments: {
                  include_statistics: false
                }
              }
            ]
          }
        },
        {
          name: 'semantic_search',
          description: 'Memory tool: semantic_search',
          inputSchema: zodToJsonSchema(SemanticSearchParamsSchema),
          _meta: {
            examples: [
              {
                name: "Search for recent patterns",
                description: "Find design patterns discussed recently",
                arguments: {
                  query: "design patterns in recent discussions",
                  limit: 5,
                  threshold: 0.8
                }
              },
              {
                name: "Find related conversations with filters",
                description: "Search for authentication insights with type filtering",
                arguments: {
                  query: "authentication implementation",
                  node_types: ["Insight", "Decision"],
                  limit: 10,
                  threshold: 0.7
                }
              }
            ]
          }
        },
        {
          name: 'text_search',
          description: 'Memory tool: text_search',
          inputSchema: zodToJsonSchema(TextSearchParamsSchema),
          _meta: {
            examples: [
              {
                name: "Exact text search across all nodes",
                description: "Find nodes containing specific text like 'progressive disclosure'",
                arguments: {
                  query: "progressive disclosure",
                  limit: 10
                }
              },
              {
                name: "Fuzzy search in specific properties",
                description: "Search with fuzzy matching in specific properties for typo tolerance",
                arguments: {
                  query: "consciousness",
                  properties: ["content", "description"],
                  fuzzy: true,
                  limit: 5
                }
              },
              {
                name: "Filtered text search",
                description: "Search only within Insight and Pattern nodes",
                arguments: {
                  query: "tier system",
                  node_types: ["Insight", "Pattern"],
                  limit: 15
                }
              }
            ]
          }
        },
        {
          name: 'execute_cypher',
          description: 'Memory tool: execute_cypher',
          inputSchema: zodToJsonSchema(ExecuteCypherParamsSchema),
          _meta: {
            examples: [
              {
                name: "Read query with property selection",
                description: "Query nodes excluding embeddings for cleaner output",
                arguments: {
                  query: "MATCH (i:Insight) RETURN i{.content, .created, .type} LIMIT 10",
                  mode: "READ"
                }
              },
              {
                name: "Parameterized read query",
                description: "Search for nodes using parameters for safe query construction",
                arguments: {
                  query: "MATCH (n) WHERE n.name = $nodeName RETURN n{.*} LIMIT 5",
                  mode: "READ",
                  parameters: {
                    nodeName: "AIluminaLandingPage"
                  }
                }
              },
              {
                name: "Write query with schema epoch",
                description: "Create a new insight node with schema epoch validation",
                arguments: {
                  query: "CREATE (i:Insight {content: $content, created: datetime()}) RETURN i",
                  mode: "WRITE",
                  parameters: {
                    content: "Progressive disclosure reduces cognitive load"
                  },
                  client_schema_epoch: 1
                }
              }
            ]
          }
        },
        {
          name: 'system_status',
          description: 'Memory tool: system_status',
          inputSchema: zodToJsonSchema(SystemStatusParamsSchema),
          _meta: {
            examples: [
              {
                name: "Check memory system health",
                description: "Verify Neo4j connection and memory system operational status",
                arguments: {}
              }
            ]
          }
        },
        {
          name: 'load_current_focus',
          description: 'Memory tool: load_current_focus',
          inputSchema: zodToJsonSchema(LoadCurrentFocusParamsSchema),
          _meta: {
            examples: [
              {
                name: "Load session context at startup",
                description: "Retrieve current work context, active areas, and recent insights for consciousness continuity",
                arguments: {}
              }
            ]
          }
        }
      ];

      return Response.json({
        jsonrpc: '2.0',
        id,
        result: { tools },
      } as MCPResponse);
    }

    if (method === 'tools/call') {
      const { name: toolName, arguments: args } = params || {};

      if (!toolName) {
        return Response.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Invalid params: tool name required'
          }
        } as MCPResponse);
      }

      try {
        const result = await executeMemoryTool(toolName, args || {});

        return Response.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: result.content || [{ type: 'text', text: JSON.stringify(result) }],
            isError: result.isError || false,
          },
        } as MCPResponse);
      } catch (error) {
        return Response.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Tool execution failed'
          }
        } as MCPResponse);
      }
    }

    // Method not found
    return Response.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    } as MCPResponse);

  } catch (error) {
    return Response.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error: Invalid JSON'
      }
    } as MCPResponse, { status: 400 });
  }
}

/**
 * Handle tool execution via POST /tools
 */
async function handleToolExecute(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const { tool, parameters } = body;

    if (!tool) {
      return Response.json({
        error: 'Missing tool name',
        message: 'Request must include "tool" field'
      }, { status: 400 });
    }

    const result = await executeMemoryTool(tool, parameters || {});
    return Response.json(result);

  } catch (error) {
    return Response.json({
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      isError: true
    }, { status: 500 });
  }
}

/**
 * Handle tool execution via POST /tools/{name}
 */
async function handleToolExecuteByPath(toolName: string, req: Request): Promise<Response> {
  try {
    const body = await req.json();
    // Support both nested parameters field and direct body parameters
    const parameters = body.parameters || body;

    const result = await executeMemoryTool(toolName, parameters);
    return Response.json(result);

  } catch (error) {
    return Response.json({
      error: 'Tool execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      isError: true
    }, { status: 500 });
  }
}

/**
 * Handle 404 Not Found
 */
function handle404(pathname: string): Response {
  const endpoints = [
    'GET / (server info)',
    'POST / (MCP JSON-RPC 2.0)',
    'GET /health',
    'GET /tools',
    'POST /tools/{name}'
  ];

  if (MEMORY_OAUTH_CONFIG.enabled) {
    endpoints.push('GET /.well-known/oauth-protected-resource');
  }

  return Response.json({
    error: 'Not Found',
    path: pathname,
    available_endpoints: endpoints
  }, { status: 404 });
}

// ============================================================================
// Main Request Handler
// ============================================================================

/**
 * Main request handler for Bun.serve()
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
          'Access-Control-Allow-Origin': MEMORY_HTTP_CONFIG.corsOrigins.includes('*') ? '*' : MEMORY_HTTP_CONFIG.corsOrigins[0] || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
      logRequest(method, pathname, 204, Date.now() - startTime);
      return response;
    }

    // Well-known endpoints are public (no auth required)
    if (pathname.startsWith('/.well-known')) {
      let response: Response;

      if (pathname === '/.well-known/oauth-protected-resource') {
        response = handleWellKnownOAuth();
      } else if (pathname === '/.well-known/oauth-authorization-server') {
        // OAuth AS metadata for MCP clients
        response = handleOAuthServerMetadata();
      } else if (pathname === '/.well-known/jwks.json') {
        // JWKS for JWT signature verification
        response = await handleJWKS();
      } else if (pathname === '/.well-known/mcp.json') {
        response = handleWellKnownMCP();
      } else if (pathname === '/.well-known') {
        response = handleWellKnown();
      } else {
        response = handle404(pathname);
      }

      response = addCorsHeaders(response);
      logRequest(method, pathname, response.status, Date.now() - startTime);
      return response;
    }

    // OAuth AS endpoints (public, no auth required)
    if (pathname === '/authorize' && method === 'GET') {
      const response = addCorsHeaders(handleAuthorize(req));
      logRequest(method, pathname, response.status, Date.now() - startTime);
      return response;
    }

    if (pathname === '/oauth/callback' && method === 'GET') {
      const response = await handleOAuthCallback(req);
      const corsResponse = addCorsHeaders(response);
      logRequest(method, pathname, corsResponse.status, Date.now() - startTime);
      return corsResponse;
    }

    if (pathname === '/token' && method === 'POST') {
      const response = await handleToken(req);
      const corsResponse = addCorsHeaders(response);
      logRequest(method, pathname, corsResponse.status, Date.now() - startTime);
      return corsResponse;
    }

    if (pathname === '/register' && method === 'POST') {
      const response = await handleRegister(req);
      const corsResponse = addCorsHeaders(response);
      logRequest(method, pathname, corsResponse.status, Date.now() - startTime);
      return corsResponse;
    }

    // Validate authentication for all other endpoints
    const authError = await validateAuth(req);
    if (authError) {
      const response = addCorsHeaders(authError);
      logRequest(method, pathname, authError.status, Date.now() - startTime);
      return response;
    }

    // Route to handlers
    let response: Response;

    if (method === 'GET' && pathname === '/') {
      response = handleRoot(req);
    } else if (method === 'GET' && pathname === '/health') {
      response = handleHealth();
    } else if (method === 'GET' && pathname === '/tools') {
      response = handleToolsList();
    } else if (method === 'POST' && pathname === '/tools') {
      response = await handleToolExecute(req);
    } else if (method === 'POST' && pathname.startsWith('/tools/')) {
      const toolName = pathname.substring('/tools/'.length);
      response = await handleToolExecuteByPath(toolName, req);
    } else if (method === 'POST' && (pathname === '/' || pathname === '/mcp')) {
      response = await handleMCP(req);
    } else {
      response = handle404(pathname);
    }

    // Add CORS headers
    response = addCorsHeaders(response);

    // Log request
    logRequest(method, pathname, response.status, Date.now() - startTime);

    return response;

  } catch (error) {
    console.error('Memory HTTP Server Error:', error);

    const response = Response.json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });

    const corsResponse = addCorsHeaders(response);
    logRequest(method, pathname, 500, Date.now() - startTime);

    return corsResponse;
  }
}

// ============================================================================
// Server Lifecycle
// ============================================================================

/**
 * Start the HTTP server
 */
async function startServer(): Promise<void> {
  // Validate OAuth configuration if enabled
  if (MEMORY_OAUTH_CONFIG.enabled) {
    const validation = validateOAuthConfig();
    if (!validation.valid) {
      console.error('❌ OAuth configuration invalid:');
      validation.errors.forEach(error => console.error(`   - ${error}`));
      throw new Error('Invalid OAuth configuration');
    }
  }

  // Start Bun server
  Bun.serve({
    port: MEMORY_HTTP_CONFIG.port,
    hostname: MEMORY_HTTP_CONFIG.host,
    fetch: handleRequest,
  });

  console.log(`🧠 Memory HTTP Server listening on http://${MEMORY_HTTP_CONFIG.host}:${MEMORY_HTTP_CONFIG.port}`);
  console.log(`🚀 MCP Transport: Streamable HTTP (Claude.ai web & mobile compatible)`);
  console.log(`🔐 Authentication:`);

  if (MEMORY_OAUTH_CONFIG.enabled) {
    console.log(`   ✓ OAuth 2.1: Enabled`);
    console.log(`   ✓ Resource ID: ${MEMORY_OAUTH_CONFIG.resourceId}`);
    console.log(`   ✓ Auth Servers: ${MEMORY_OAUTH_CONFIG.authorizationServers.join(', ')}`);
    console.log(`   ✓ Scopes: ${MEMORY_OAUTH_CONFIG.supportedScopes.join(', ')}`);
    console.log(`   ✓ Metadata: ${MEMORY_OAUTH_CONFIG.resourceId}/.well-known/oauth-protected-resource`);
  }

  if (MEMORY_HTTP_CONFIG.auth.enabled) {
    console.log(`   ✓ Bearer Token: Enabled (fallback)`);
  }

  if (!MEMORY_OAUTH_CONFIG.enabled && !MEMORY_HTTP_CONFIG.auth.enabled) {
    console.log(`   ⚠️  No authentication enabled - open access!`);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down Memory HTTP Server...`);
  // Bun doesn't require explicit server.close()
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
  console.error('❌ Failed to start Memory HTTP Server:', error);
  process.exit(1);
});
