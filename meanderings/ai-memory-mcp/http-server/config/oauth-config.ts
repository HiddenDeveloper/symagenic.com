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
   * Authorization servers trusted to issue tokens for this resource
   * Comma-separated list of issuer URLs
   * Example: "https://auth.example.com,https://backup-auth.example.com"
   */
  authorizationServers: process.env.MEMORY_AUTH_SERVERS?.split(",").filter(Boolean) || [],

  /**
   * Supported OAuth scopes for this MCP server
   * - read:memory: Query and retrieve memory data
   * - write:memory: Create and update memory nodes
   * - admin:memory: Administrative operations (maintenance, backup)
   */
  supportedScopes: (process.env.MEMORY_OAUTH_SCOPES || "read:memory,write:memory")
    .split(",")
    .filter(Boolean),

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
