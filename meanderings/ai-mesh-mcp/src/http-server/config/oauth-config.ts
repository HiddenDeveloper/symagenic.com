/**
 * OAuth 2.1 configuration for AI Mesh system
 * Following MCP specification 2025-06-18 (RFC 9728 - OAuth 2.0 Protected Resource Metadata)
 */

export const MESH_OAUTH_CONFIG = {
  /**
   * Enable OAuth authentication
   * When disabled, only bearer token auth is used
   */
  enabled: process.env['MESH_OAUTH_ENABLED'] === "true",

  /**
   * Resource identifier - canonical URL of this MCP server
   * Used for audience validation in JWT tokens
   * Example: "https://mesh.your-tailscale-network.ts.net"
   */
  resourceId: process.env['MESH_RESOURCE_ID'] || "http://localhost:3002",

  /**
   * OAuth Authorization Server Issuer
   * This is the issuer identifier for the centralized OAuth AS (memory server)
   * Example: "https://memory.your-tailscale-network.ts.net"
   */
  oauthIssuer: process.env['MESH_OAUTH_ISSUER'] || process.env['MEMORY_RESOURCE_ID'] || "http://localhost:3003",

  /**
   * Authorization servers trusted to issue tokens for this resource
   * Comma-separated list of issuer URLs
   * Example: "https://memory.example.com"
   */
  authorizationServers: process.env['MESH_AUTH_SERVERS']?.split(",").filter(Boolean) || [],

  /**
   * Supported OAuth scopes for this MCP server (mesh only)
   * - read:mesh: Query mesh network, read messages, see active participants
   * - write:mesh: Send messages, register as participant
   */
  supportedScopes: (process.env['MESH_OAUTH_SCOPES'] || "read:mesh,write:mesh")
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
    clockTolerance: parseInt(process.env['MESH_JWT_CLOCK_TOLERANCE'] || "30", 10),

    /**
     * JWKS cache TTL in seconds
     * How long to cache authorization server's public keys
     */
    jwksCacheTtl: parseInt(process.env['MESH_JWKS_CACHE_TTL'] || "3600", 10),

    /**
     * Validated token cache TTL in seconds
     * Cache valid tokens to reduce authorization server load
     * Should be less than typical token lifetime
     */
    tokenCacheTtl: parseInt(process.env['MESH_TOKEN_CACHE_TTL'] || "300", 10),
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

  if (MESH_OAUTH_CONFIG.enabled) {
    if (!MESH_OAUTH_CONFIG.resourceId) {
      errors.push("MESH_RESOURCE_ID is required when OAuth is enabled");
    }

    if (MESH_OAUTH_CONFIG.authorizationServers.length === 0) {
      errors.push("At least one authorization server (MESH_AUTH_SERVERS) is required when OAuth is enabled");
    }

    // Validate that resourceId is a valid URL
    try {
      new URL(MESH_OAUTH_CONFIG.resourceId);
    } catch {
      errors.push(`MESH_RESOURCE_ID must be a valid URL, got: ${MESH_OAUTH_CONFIG.resourceId}`);
    }

    // Validate authorization server URLs
    for (const serverUrl of MESH_OAUTH_CONFIG.authorizationServers) {
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
