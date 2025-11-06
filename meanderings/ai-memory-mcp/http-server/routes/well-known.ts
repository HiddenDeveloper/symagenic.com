/**
 * Well-known routes for OAuth 2.0 Protected Resource Metadata
 * Implements RFC 9728 for MCP authorization discovery
 */

import { Router, type Router as ExpressRouter } from 'express';
import { MEMORY_OAUTH_CONFIG } from '../config/oauth-config.js';

const router: ExpressRouter = Router();

/**
 * OAuth 2.0 Protected Resource Metadata endpoint
 * Per RFC 9728 and MCP specification 2025-06-18
 *
 * This endpoint allows MCP clients (like Claude) to discover:
 * - Which authorization servers can issue tokens for this resource
 * - What scopes are supported
 * - How to present bearer tokens
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 * @see https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
 */
router.get('/.well-known/oauth-protected-resource', (req, res) => {
  // Return 404 if OAuth is not enabled
  if (!MEMORY_OAUTH_CONFIG.enabled) {
    res.status(404).json({
      error: 'oauth_not_configured',
      message: 'OAuth authentication is not enabled on this server'
    });
    return;
  }

  // Validate that we have required configuration
  if (MEMORY_OAUTH_CONFIG.authorizationServers.length === 0) {
    res.status(500).json({
      error: 'oauth_misconfigured',
      message: 'No authorization servers configured'
    });
    return;
  }

  /**
   * RFC 9728 Protected Resource Metadata
   */
  const metadata = {
    /**
     * REQUIRED: The resource identifier
     * This is the canonical URI of this MCP server
     */
    resource: MEMORY_OAUTH_CONFIG.resourceId,

    /**
     * REQUIRED: Array of authorization server URLs
     * These servers are trusted to issue tokens for this resource
     */
    authorization_servers: MEMORY_OAUTH_CONFIG.authorizationServers,

    /**
     * OPTIONAL: OAuth scopes supported by this resource
     */
    scopes_supported: MEMORY_OAUTH_CONFIG.supportedScopes,

    /**
     * OPTIONAL: Methods for presenting bearer tokens
     * Currently only "header" (Authorization: Bearer <token>)
     */
    bearer_methods_supported: MEMORY_OAUTH_CONFIG.bearerMethodsSupported,

    /**
     * Additional metadata for MCP-specific features
     */
    mcp_version: "2025-06-18",

    /**
     * Token requirements
     */
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none" // For public clients with PKCE
    ],
  };

  // Set appropriate cache headers
  // Cache for a reasonable time to reduce load, but allow updates
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.set('Content-Type', 'application/json');

  res.json(metadata);
  return;
});

/**
 * MCP Server Manifest
 * Required for Claude.ai custom connectors to discover server capabilities
 *
 * @see https://modelcontextprotocol.io/docs/concepts/architecture
 */
router.get('/.well-known/mcp.json', (req, res) => {
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

  res.set('Cache-Control', 'public, max-age=3600');
  res.set('Content-Type', 'application/json');
  res.json(manifest);
});

/**
 * Root well-known directory listing (optional convenience)
 * Helps developers discover available metadata endpoints
 */
router.get('/.well-known', (req, res) => {
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

  res.json({
    service: 'ai-memory-mcp',
    description: 'Model Context Protocol Memory Server',
    endpoints: endpoints.filter(e => e.available),
  });
});

export { router as wellKnownRouter };
