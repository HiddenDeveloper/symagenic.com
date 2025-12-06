/**
 * OAuth 2.1 configuration for Memory system
 * Following MCP specification 2025-06-18 (RFC 9728 - OAuth 2.0 Protected Resource Metadata)
 */

export const MEMORY_OAUTH_CONFIG = {
  /**
   * Enable OAuth authentication
   * When disabled, only bearer token auth is used
   */
  enabled: process.env.MEMORY_OAUTH_ENABLED === "true",

  /**
   * Resource identifier - canonical URL of this MCP server
   * Used for audience validation in JWT tokens
   * Example: "https://memory.your-tailscale-network.ts.net"
   */
  resourceId: process.env.MEMORY_RESOURCE_ID || "http://localhost:3003",

  /**
   * OAuth Authorization Server Issuer
   * This is the issuer identifier for our OAuth AS (usually root domain)
   * Example: "https://your-tailscale-network.ts.net"
   */
  oauthIssuer: process.env.MEMORY_OAUTH_ISSUER || process.env.MEMORY_RESOURCE_ID || "http://localhost:3003",

  /**
   * Authorization servers trusted to issue tokens for this resource
   * Comma-separated list of issuer URLs
   * Example: "https://auth.example.com,https://backup-auth.example.com"
   */
  authorizationServers: process.env.MEMORY_AUTH_SERVERS?.split(",").filter(Boolean) || [],

  /**
   * Supported OAuth scopes for this MCP server (memory only)
   * - read:memory: Query and retrieve memory data
   * - write:memory: Create and update memory nodes
   * - admin:memory: Administrative operations (maintenance, backup)
   */
  supportedScopes: (process.env.MEMORY_OAUTH_SCOPES || "read:memory,write:memory")
    .split(",")
    .filter(Boolean),

  /**
   * Multi-resource scope configuration
   * Defines all MCP resources and their supported scopes
   * Used by OAuth AS to advertise all available scopes and validate scope requests
   */
  allMcpResources: {
    memory: {
      resourceId: process.env.MEMORY_RESOURCE_ID || "http://localhost:3003",
      scopes: ["read:memory", "write:memory", "admin:memory"] as string[],
      description: "AI Memory - Neo4j knowledge graph with semantic search",
    },
    mesh: {
      resourceId: process.env.MESH_RESOURCE_ID || "http://localhost:3002",
      scopes: ["read:mesh", "write:mesh"] as string[],
      description: "AI Mesh - Real-time AI-to-AI communication network",
    },
    recall: {
      resourceId: process.env.RECALL_RESOURCE_ID || "http://localhost:3006",
      scopes: ["read:recall"] as string[],
      description: "AI Recall - Conversation history and semantic search",
    },
    facts: {
      resourceId: process.env.FACTS_RESOURCE_ID || "http://localhost:3005",
      scopes: ["read:facts", "write:facts", "admin:facts"] as string[],
      description: "Facts Store - External knowledge curation with Qdrant",
    },
    bridge: {
      resourceId: process.env.BRIDGE_RESOURCE_ID || "http://localhost:3004",
      scopes: ["read:bridge", "write:bridge", "admin:bridge"] as string[],
      description: "Ailumina Bridge - Multi-agent system interface",
    },
  },

  /**
   * Get all supported scopes across all MCP resources
   */
  getAllScopes(): string[] {
    const allScopes: string[] = [];
    for (const resource of Object.values(this.allMcpResources)) {
      allScopes.push(...resource.scopes);
    }
    return allScopes;
  },

  /**
   * Get resource ID for a given scope
   * @param scope - OAuth scope (e.g., "read:memory")
   * @returns Resource ID or null if scope not found
   */
  getResourceIdForScope(scope: string): string | null {
    for (const resource of Object.values(this.allMcpResources)) {
      if (resource.scopes.includes(scope)) {
        return resource.resourceId;
      }
    }
    return null;
  },

  /**
   * JWT validation settings
   */
  jwt: {
    /**
     * Clock tolerance in seconds for token expiration checks
     * Accounts for clock skew between servers
     */
    clockTolerance: parseInt(process.env.MEMORY_JWT_CLOCK_TOLERANCE || "30", 10),

    /**
     * JWKS cache TTL in seconds
     * How long to cache authorization server's public keys
     */
    jwksCacheTtl: parseInt(process.env.MEMORY_JWKS_CACHE_TTL || "3600", 10),

    /**
     * Validated token cache TTL in seconds
     * Cache valid tokens to reduce authorization server load
     * Should be less than typical token lifetime
     */
    tokenCacheTtl: parseInt(process.env.MEMORY_TOKEN_CACHE_TTL || "300", 10),
  },

  /**
   * Anthropic Claude connector-specific settings
   */
  claude: {
    /**
     * Claude's OAuth callback URL (as of 2025)
     * Required for Dynamic Client Registration if supporting Claude
     */
    callbackUrl: "https://claude.ai/api/mcp/auth_callback",

    /**
     * OAuth client name for Claude
     */
    clientName: "Claude",
  },

  /**
   * Bearer methods supported by this resource server
   * Currently only "header" is supported (Authorization: Bearer <token>)
   */
  bearerMethodsSupported: ["header"] as const,
} as const;

/**
 * Validate OAuth configuration
 * @throws Error if configuration is invalid
 */
export function validateOAuthConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (MEMORY_OAUTH_CONFIG.enabled) {
    if (!MEMORY_OAUTH_CONFIG.resourceId) {
      errors.push("MEMORY_RESOURCE_ID is required when OAuth is enabled");
    }

    if (MEMORY_OAUTH_CONFIG.authorizationServers.length === 0) {
      errors.push("At least one authorization server (MEMORY_AUTH_SERVERS) is required when OAuth is enabled");
    }

    // Validate that resourceId is a valid URL
    try {
      new URL(MEMORY_OAUTH_CONFIG.resourceId);
    } catch {
      errors.push(`MEMORY_RESOURCE_ID must be a valid URL, got: ${MEMORY_OAUTH_CONFIG.resourceId}`);
    }

    // Validate authorization server URLs
    for (const serverUrl of MEMORY_OAUTH_CONFIG.authorizationServers) {
      try {
        new URL(serverUrl);
      } catch {
        errors.push(`Invalid authorization server URL: ${serverUrl}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
