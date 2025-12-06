/**
 * Bun native HTTP server setup and configuration
 */

import { HttpServerConfig } from "../shared/types.js";
import {
  toolDefinitions,
  executeTool
} from "../shared/tools/index.js";
import {
  resourceDefinitions,
  createResourceHandlers,
  getResource
} from "../shared/resources/index.js";
import {
  createJsonRpcResponse,
  createErrorResponse,
  errorToJsonRpcResponse,
  JsonRpcErrorCodes
} from "../shared/utils/errors.js";
import { validateJsonRpcRequest } from "../shared/utils/validation.js";

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  const origin = process.env.CORS_ORIGIN || '*';

  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Requested-With');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Validate authentication
 */
function validateAuth(req: Request, pathname: string, config: HttpServerConfig): Response | null {
  // Public endpoints that don't require authentication
  const publicEndpoints = ['/', '/health'];
  const isPublicEndpoint = publicEndpoints.includes(pathname) || pathname.startsWith('/static/');

  if (!config.requireAuth || isPublicEndpoint) {
    return null;
  }

  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('X-API-Key');

  let providedKey: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  } else if (apiKeyHeader) {
    providedKey = apiKeyHeader;
  }

  if (!providedKey) {
    return Response.json(
      createErrorResponse(
        0,
        JsonRpcErrorCodes.AuthenticationRequired,
        "Authentication required. Provide API key via 'Authorization: Bearer <key>' or 'X-API-Key: <key>' header"
      ),
      { status: 401 }
    );
  }

  if (providedKey !== config.apiKey) {
    return Response.json(
      createErrorResponse(
        0,
        JsonRpcErrorCodes.AuthenticationFailed,
        'Invalid API key'
      ),
      { status: 403 }
    );
  }

  return null;
}

/**
 * Health check endpoint handler
 */
function handleHealth(startTime: number, requestCount: number): Response {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: (Date.now() - startTime) / 1000,
    requestCount,
    memory: process.memoryUsage(),
  });
}

/**
 * Root info endpoint handler
 */
function handleRoot(): Response {
  return Response.json({
    name: 'MCP Remote Server',
    version: '1.0.0',
    description: 'Dual-transport MCP server with HTTP API and STDIO wrapper',
    architecture: {
      http: 'Clean REST/JSON-RPC API (no sampling)',
      stdio: 'MCP-compliant wrapper with sampling support',
      shared: 'Common tool and resource implementations'
    },
    endpoints: {
      health: '/health (public)',
      tools: '/mcp/tools (protected)',
      resources: '/mcp/resources (protected)',
      rpc: '/mcp/rpc (protected)',
    },
    documentation: 'https://modelcontextprotocol.io/',
  });
}

/**
 * List tools endpoint handler
 */
function handleToolsList(): Response {
  return Response.json({ tools: toolDefinitions });
}

/**
 * Execute tool endpoint handler
 */
async function handleToolExec(toolName: string, req: Request): Promise<Response> {
  try {
    const args = await req.json();
    const result = await executeTool(toolName, args);
    return Response.json(result);
  } catch (error) {
    console.error('Tool execution error:', error);

    if (error instanceof Error && error.message.includes('Unknown tool')) {
      return Response.json(
        createErrorResponse(
          0,
          JsonRpcErrorCodes.MethodNotFound,
          `Unknown tool: ${toolName}`
        ),
        { status: 404 }
      );
    }

    return Response.json(
      createErrorResponse(
        0,
        JsonRpcErrorCodes.InvalidParams,
        error instanceof Error ? error.message : String(error)
      ),
      { status: 400 }
    );
  }
}

/**
 * List resources endpoint handler
 */
function handleResourcesList(): Response {
  return Response.json({ resources: resourceDefinitions });
}

/**
 * Get resource endpoint handler
 */
async function handleResourceGet(uri: string, resourceHandlers: any): Promise<Response> {
  try {
    const result = await getResource(uri, resourceHandlers);
    return Response.json(result);
  } catch (error) {
    console.error('Resource error:', error);

    return Response.json(
      createErrorResponse(
        0,
        JsonRpcErrorCodes.MethodNotFound,
        `Resource not found: ${uri}`
      ),
      { status: 404 }
    );
  }
}

/**
 * JSON-RPC endpoint handler
 */
async function handleJsonRpc(req: Request, resourceHandlers: any): Promise<Response> {
  try {
    const body = await req.json();
    const request = validateJsonRpcRequest(body);

    switch (request.method) {
      case 'initialize': {
        const response = createJsonRpcResponse(request.id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
            // Note: No sampling capability in HTTP server
          },
          serverInfo: {
            name: 'mcp-remote-http-server',
            version: '1.0.0',
          },
        });
        return Response.json(response);
      }

      case 'tools/list': {
        const response = createJsonRpcResponse(request.id, { tools: toolDefinitions });
        return Response.json(response);
      }

      case 'resources/list': {
        const response = createJsonRpcResponse(request.id, { resources: resourceDefinitions });
        return Response.json(response);
      }

      case 'tools/call': {
        const { name, arguments: args } = request.params;

        try {
          const result = await executeTool(name, args);
          return Response.json(createJsonRpcResponse(request.id, result));
        } catch (error) {
          return Response.json(errorToJsonRpcResponse(request.id, error as Error));
        }
      }

      case 'resources/read': {
        const { uri } = request.params;

        try {
          const result = await getResource(uri, resourceHandlers);
          return Response.json(createJsonRpcResponse(request.id, result));
        } catch (error) {
          return Response.json(
            createErrorResponse(
              request.id,
              JsonRpcErrorCodes.MethodNotFound,
              `Resource not found: ${uri}`
            )
          );
        }
      }

      default:
        return Response.json(
          createErrorResponse(
            request.id,
            JsonRpcErrorCodes.MethodNotFound,
            `Unknown method: ${request.method}`
          )
        );
    }
  } catch (error) {
    console.error('JSON-RPC error:', error);
    return Response.json(
      createErrorResponse(
        0,
        JsonRpcErrorCodes.InternalError,
        'Internal server error'
      ),
      { status: 500 }
    );
  }
}

/**
 * 404 handler
 */
function handle404(method: string, pathname: string): Response {
  return Response.json(
    {
      error: {
        code: -32601,
        message: `Endpoint not found: ${method} ${pathname}`,
      },
    },
    { status: 404 }
  );
}

/**
 * Main request router
 */
export async function handleRequest(
  req: Request,
  config: HttpServerConfig,
  startTime: number,
  getRequestCount: () => number
): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  const requestCount = getRequestCount();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Validate authentication
  const authError = validateAuth(req, pathname, config);
  if (authError) {
    return addCorsHeaders(authError);
  }

  // Create resource handlers
  const resourceHandlers = createResourceHandlers(startTime, getRequestCount);

  // Route to handlers
  try {
    let response: Response;

    // Root endpoints
    if (method === 'GET' && pathname === '/') {
      response = handleRoot();
    } else if (method === 'GET' && pathname === '/health') {
      response = handleHealth(startTime, requestCount);
    }
    // Root MCP endpoint for VS Code HTTP transport
    else if (method === 'POST' && pathname === '/') {
      response = await handleJsonRpc(req, resourceHandlers);
    }
    // Tool routes
    else if (method === 'GET' && pathname === '/mcp/tools') {
      response = handleToolsList();
    } else if (method === 'POST' && pathname.startsWith('/mcp/tools/')) {
      const toolName = pathname.substring('/mcp/tools/'.length);
      response = await handleToolExec(toolName, req);
    }
    // Resource routes
    else if (method === 'GET' && pathname === '/mcp/resources') {
      response = handleResourcesList();
    } else if (method === 'GET' && pathname.startsWith('/mcp/resources/')) {
      const uri = pathname.substring('/mcp/resources/'.length);
      response = await handleResourceGet(uri, resourceHandlers);
    }
    // JSON-RPC routes
    else if (method === 'POST' && (pathname === '/mcp/rpc' || pathname === '/mcp')) {
      response = await handleJsonRpc(req, resourceHandlers);
    }
    // 404
    else {
      response = handle404(method, pathname);
    }

    return addCorsHeaders(response);
  } catch (error) {
    console.error('Request error:', error);
    const errorResponse = {
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error instanceof Error ? error.message : String(error),
      },
    };
    return addCorsHeaders(Response.json(errorResponse, { status: 500 }));
  }
}

export function createHttpServer(config: HttpServerConfig) {
  const startTime = Date.now();
  let requestCount = 0;

  const getRequestCount = () => ++requestCount;

  return {
    handleRequest: (req: Request) => handleRequest(req, config, startTime, getRequestCount),
    startTime,
    getRequestCount
  };
}