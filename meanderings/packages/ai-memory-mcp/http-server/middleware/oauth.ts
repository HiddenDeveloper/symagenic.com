/**
 * OAuth 2.1 JWT validation middleware for Memory MCP server
 * Implements RFC 9728 (OAuth 2.0 Protected Resource Metadata)
 * Following MCP specification 2025-06-18
 */

import { type Request, type Response, type NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import NodeCache from 'node-cache';
import { MEMORY_OAUTH_CONFIG, validateOAuthConfig } from '../config/oauth-config.js';

/**
 * Cache for JWKS (JSON Web Key Sets) from authorization servers
 * Keys: issuer URL, Values: JWKS fetch function
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Cache for validated tokens to reduce authorization server load
 * Keys: token hash, Values: validated payload
 */
const tokenCache = new NodeCache({
  stdTTL: MEMORY_OAUTH_CONFIG.jwt.tokenCacheTtl,
  checkperiod: 60, // Check for expired entries every 60 seconds
  useClones: false, // Don't clone objects (performance)
});

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
 * Augmented Express Request with OAuth information
 */
export interface OAuthRequest extends Request {
  oauth?: {
    /** Validated JWT payload */
    payload: OAuthPayload;
    /** Parsed scopes array */
    scopes: string[];
    /** Access token */
    token: string;
  };
}

/**
 * Extract and decode (but don't verify) JWT to get issuer
 * SECURITY: This is safe because we only extract metadata, not trust the token yet
 */
function extractUnverifiedIssuer(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    // Decode payload (base64url)
    // Using non-null assertion since we've checked parts[1] exists above
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
 * SECURITY: Only fetch JWKS from pre-configured authorization servers
 */
function getJWKS(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  // Check cache first
  const cached = jwksCache.get(issuer);
  if (cached) {
    return cached;
  }

  // Create new JWKS fetcher with issuer's JWKS endpoint
  // Standard location is {issuer}/.well-known/jwks.json
  const jwksUrl = new URL('/.well-known/jwks.json', issuer);
  const jwks = createRemoteJWKSet(jwksUrl);

  // Cache it
  jwksCache.set(issuer, jwks);

  return jwks;
}

/**
 * Simple token hash for caching (first 20 chars of token)
 * Not cryptographic - just for cache key uniqueness
 */
function tokenHash(token: string): string {
  return token.substring(0, 20);
}

/**
 * Validate JWT access token
 * SECURITY CRITICAL: Implements all required security checks per OAuth 2.1
 *
 * @param token - JWT access token from Authorization header
 * @returns Validated payload or null if invalid
 */
async function validateJWT(token: string): Promise<OAuthPayload | null> {
  try {
    // Check token cache first
    const hash = tokenHash(token);
    const cached = tokenCache.get<OAuthPayload>(hash);
    if (cached) {
      return cached;
    }

    // Step 1: Extract issuer from unverified token
    const issuer = extractUnverifiedIssuer(token);
    if (!issuer) {
      console.warn('[OAuth] Failed to extract issuer from token');
      return null;
    }

    // Step 2: Verify issuer is in our configured authorization servers
    // SECURITY: Never trust token-provided issuer without checking our config
    if (!MEMORY_OAUTH_CONFIG.authorizationServers.includes(issuer)) {
      console.warn(`[OAuth] Token issuer not authorized: ${issuer}`);
      return null;
    }

    // Step 3: Get JWKS for this issuer
    const jwks = getJWKS(issuer);

    // Step 4: Verify JWT signature and claims
    const { payload } = await jwtVerify(token, jwks, {
      // Verify issuer exactly matches
      issuer: issuer,

      // Verify audience matches our resource identifier
      // SECURITY CRITICAL: Prevents token reuse across different services
      audience: MEMORY_OAUTH_CONFIG.resourceId,

      // Clock tolerance for expiration checks (handles clock skew)
      clockTolerance: MEMORY_OAUTH_CONFIG.jwt.clockTolerance,
    });

    // Step 5: Cache validated token
    tokenCache.set(hash, payload);

    return payload as OAuthPayload;
  } catch (error) {
    // Log validation failures for security monitoring
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
 * Scopes can be either a space-separated string or an array
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
 * OAuth JWT validation middleware
 *
 * This middleware attempts to validate OAuth JWT tokens.
 * It does NOT enforce authentication - that's done by the auth middleware.
 * This middleware only populates req.oauth if a valid JWT is present.
 *
 * Usage:
 *   app.use(oauthMiddleware);
 *   app.use(authMiddleware); // This enforces authentication
 */
export async function oauthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip if OAuth is disabled
  if (!MEMORY_OAUTH_CONFIG.enabled) {
    return next();
  }

  // Validate configuration on first use
  const configValidation = validateOAuthConfig();
  if (!configValidation.valid) {
    console.error('[OAuth] Invalid configuration:', configValidation.errors);
    // Continue without OAuth (will fall back to bearer token if available)
    return next();
  }

  // Extract Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No bearer token - continue without OAuth
    return next();
  }

  // Extract token
  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Check if this looks like a JWT (3 parts separated by dots)
  if (token.split('.').length !== 3) {
    // Not a JWT - continue (might be simple bearer token)
    return next();
  }

  // Validate JWT
  const payload = await validateJWT(token);
  if (!payload) {
    // Invalid JWT - continue without OAuth
    // The auth middleware will handle rejection if needed
    return next();
  }

  // Attach OAuth information to request
  (req as OAuthRequest).oauth = {
    payload,
    scopes: parseScopes(payload),
    token,
  };

  next();
}

/**
 * Middleware to require specific OAuth scopes
 * Use after oauthMiddleware and authMiddleware
 *
 * @param requiredScopes - Scopes that must be present in the token
 *
 * @example
 * app.post('/admin/backup',
 *   oauthMiddleware,
 *   authMiddleware,
 *   requireScopes(['admin:memory']),
 *   backupHandler
 * );
 */
export function requireScopes(requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const oauthReq = req as OAuthRequest;

    // If no OAuth information, reject
    if (!oauthReq.oauth) {
      res.status(403).json({
        error: 'insufficient_scope',
        message: `Required scopes: ${requiredScopes.join(', ')}`,
        required_scopes: requiredScopes,
      });
      return;
    }

    // Check if all required scopes are present
    const hasAllScopes = requiredScopes.every(scope =>
      oauthReq.oauth!.scopes.includes(scope)
    );

    if (!hasAllScopes) {
      res.status(403).json({
        error: 'insufficient_scope',
        message: `Required scopes: ${requiredScopes.join(', ')}`,
        required_scopes: requiredScopes,
        provided_scopes: oauthReq.oauth.scopes,
      });
      return;
    }

    next();
  };
}

/**
 * Clear token cache (useful for testing or security incidents)
 */
export function clearTokenCache(): void {
  tokenCache.flushAll();
  console.log('[OAuth] Token cache cleared');
}

/**
 * Clear JWKS cache (useful for key rotation)
 */
export function clearJWKSCache(): void {
  jwksCache.clear();
  console.log('[OAuth] JWKS cache cleared');
}
