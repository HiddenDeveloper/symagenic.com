/**
 * OAuth 2.1 configuration for Qdrant Facts system
 * Following MCP specification 2025-06-18 (RFC 9728 - OAuth 2.0 Protected Resource Metadata)
 */

export const FACTS_OAUTH_CONFIG = {
  /**
   * Enable OAuth authentication
   * When disabled, only bearer token auth is used
   */
  enabled: process.env['FACTS_OAUTH_ENABLED'] === "true",

  /**
   * Resource identifier - canonical URL of this MCP server
   * Used for audience validation in JWT tokens
   * Example: "https://facts.your-tailscale-network.ts.net"
   */
  resourceId: process.env['FACTS_RESOURCE_ID'] || "http://localhost:3005",

  /**
   * OAuth Authorization Server Issuer
   * This is the issuer identifier for the centralized OAuth AS (memory server)
   * Example: "https://memory.your-tailscale-network.ts.net"
   */
  oauthIssuer: process.env['FACTS_OAUTH_ISSUER'] || process.env['MEMORY_RESOURCE_ID'] || "http://localhost:3003",

  /**
   * Authorization servers trusted to issue tokens for this resource
   * Comma-separated list of issuer URLs
   * Example: "https://memory.example.com"
   */
  authorizationServers: process.env['FACTS_AUTH_SERVERS']?.split(",").filter(Boolean) || [],

  /**
   * Supported OAuth scopes for this MCP server (facts only)
   * - read:facts: Query facts pool, semantic search
   * - write:facts: Add facts, update verification status
   * - admin:facts: Collection management, bulk operations
   */
  supportedScopes: (process.env['FACTS_OAUTH_SCOPES'] || "read:facts,write:facts,admin:facts")
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
    clockTolerance: parseInt(process.env['FACTS_JWT_CLOCK_TOLERANCE'] || "30", 10),

    /**
     * JWKS cache TTL in seconds
     * How long to cache authorization server's public keys
     */
    jwksCacheTtl: parseInt(process.env['FACTS_JWKS_CACHE_TTL'] || "3600", 10),

    /**
     * Validated token cache TTL in seconds
     * Cache valid tokens to reduce authorization server load
     * Should be less than typical token lifetime
     */
    tokenCacheTtl: parseInt(process.env['FACTS_TOKEN_CACHE_TTL'] || "300", 10),
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

  if (FACTS_OAUTH_CONFIG.enabled) {
    if (!FACTS_OAUTH_CONFIG.resourceId) {
      errors.push("FACTS_RESOURCE_ID is required when OAuth is enabled");
    }

    if (FACTS_OAUTH_CONFIG.authorizationServers.length === 0) {
      errors.push("At least one authorization server (FACTS_AUTH_SERVERS) is required when OAuth is enabled");
    }

    // Validate that resourceId is a valid URL
    try {
      new URL(FACTS_OAUTH_CONFIG.resourceId);
    } catch {
      errors.push(`FACTS_RESOURCE_ID must be a valid URL, got: ${FACTS_OAUTH_CONFIG.resourceId}`);
    }

    // Validate authorization server URLs
    for (const serverUrl of FACTS_OAUTH_CONFIG.authorizationServers) {
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
