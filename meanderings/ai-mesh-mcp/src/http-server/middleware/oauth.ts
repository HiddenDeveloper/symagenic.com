/**
 * OAuth 2.1 JWT validation middleware for AI Mesh MCP server
 * Validates JWT tokens issued by the centralized OAuth AS (memory server)
 * Uses JWKS for independent signature verification (no introspection)
 */

import type { Request, Response, NextFunction } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { JWTPayload } from "jose";
import { MESH_OAUTH_CONFIG } from "../config/oauth-config.js";

// Extend Express Request to include OAuth info
declare global {
  namespace Express {
    interface Request {
      oauth?: {
        validated: boolean;
        scopes: string[];
        clientId?: string;
        resource?: string;
      };
    }
  }
}

/**
 * Token validation session data
 */
interface TokenSession {
  scopes: string[];
  sub: string;
  resource: string;
  exp: number;
}

/**
 * JWKS cache - reuse across requests
 */
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCacheTime = 0;

/**
 * Token cache - avoid re-validating same token multiple times
 */
const tokenCache = new Map<string, { session: TokenSession; timestamp: number }>();

/**
 * Get or create JWKS remote set
 */
function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  const now = Date.now();
  const cacheExpired = now - jwksCacheTime > MESH_OAUTH_CONFIG.jwt.jwksCacheTtl * 1000;

  if (!jwksCache || cacheExpired) {
    // Get first authorization server (there should only be one - the memory server)
    const authServer = MESH_OAUTH_CONFIG.authorizationServers[0];
    if (!authServer) {
      throw new Error("No authorization server configured");
    }

    // Construct JWKS URL
    const jwksUrl = new URL("/.well-known/jwks.json", authServer);
    console.log(`[OAuth] Fetching JWKS from ${jwksUrl.toString()}`);

    jwksCache = createRemoteJWKSet(jwksUrl);
    jwksCacheTime = now;
  }

  return jwksCache;
}

/**
 * Validate JWT token
 * @param token - JWT token string
 * @returns Token session data or null if invalid
 */
async function validateJWT(token: string): Promise<TokenSession | null> {
  // Check token cache first
  const cached = tokenCache.get(token);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    const cacheExpired = age > MESH_OAUTH_CONFIG.jwt.tokenCacheTtl * 1000;

    if (!cacheExpired) {
      // Check if token is still valid (not expired)
      if (cached.session.exp * 1000 > Date.now()) {
        console.log("[OAuth] Token cache hit");
        return cached.session;
      } else {
        // Token expired, remove from cache
        tokenCache.delete(token);
      }
    } else {
      // Cache expired, remove from cache
      tokenCache.delete(token);
    }
  }

  try {
    const jwks = getJWKS();

    // Verify JWT signature and claims
    const { payload } = await jwtVerify(token, jwks, {
      issuer: MESH_OAUTH_CONFIG.oauthIssuer,
      audience: MESH_OAUTH_CONFIG.resourceId,
      clockTolerance: MESH_OAUTH_CONFIG.jwt.clockTolerance,
    });

    // Extract session data
    const session: TokenSession = {
      scopes: typeof payload['scope'] === "string" ? payload['scope'].split(" ") : [],
      sub: payload.sub || "",
      resource: typeof payload.aud === "string"
        ? payload.aud
        : (Array.isArray(payload.aud) ? (payload.aud[0] || "") : ""),
      exp: payload.exp || 0,
    };

    // Cache the validated token
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
 * OAuth validation middleware
 * Validates JWT tokens issued by the OAuth AS
 * Falls back to next middleware if OAuth is disabled
 */
export function createOAuthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if OAuth is not enabled
    if (!MESH_OAUTH_CONFIG.enabled) {
      return next();
    }

    // Skip OAuth for public endpoints
    if (req.path === "/health" || req.path === "/" || req.path === "/.well-known/oauth-protected-resource") {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No bearer token - let the next auth middleware handle it
      return next();
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return next();
    }

    // Try to validate as JWT
    const session = await validateJWT(token);

    if (session) {
      // JWT validation successful
      req.oauth = {
        validated: true,
        scopes: session.scopes,
        clientId: session.sub,
        resource: session.resource,
      };

      // Mark as authenticated
      req.isAuthenticated = true;
      req.authToken = token;

      console.log(`[OAuth] Request authenticated via JWT: client=${session.sub}, scopes=[${session.scopes.join(", ")}]`);
      return next();
    }

    // JWT validation failed - continue to bearer token auth
    next();
  };
}

/**
 * Scope validation middleware
 * Ensures the request has the required OAuth scopes
 * @param requiredScopes - Array of required scopes (OR logic - any scope matches)
 */
export function requireScopes(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!MESH_OAUTH_CONFIG.enabled) {
      // OAuth disabled - skip scope check
      return next();
    }

    if (!req.oauth?.validated) {
      // Not authenticated via OAuth - skip scope check (fallback auth in use)
      return next();
    }

    // Check if any of the required scopes are present
    const hasRequiredScope = requiredScopes.some((scope) =>
      req.oauth?.scopes.includes(scope)
    );

    if (!hasRequiredScope) {
      return res.status(403).json({
        error: "insufficient_scope",
        error_description: `Required scopes: ${requiredScopes.join(" or ")}`,
        scopes_available: req.oauth.scopes,
      });
    }

    next();
  };
}

/**
 * Protected resource metadata endpoint
 * RFC 9728 - OAuth 2.0 Protected Resource Metadata
 */
export function createProtectedResourceMetadata() {
  return (_req: Request, res: Response) => {
    const metadata = {
      resource: MESH_OAUTH_CONFIG.resourceId,
      authorization_servers: MESH_OAUTH_CONFIG.authorizationServers,
      scopes_supported: MESH_OAUTH_CONFIG.supportedScopes,
      bearer_methods_supported: MESH_OAUTH_CONFIG.bearerMethodsSupported,
      resource_documentation: `${MESH_OAUTH_CONFIG.resourceId}/docs`,
      resource_signing_alg_values_supported: ["RS256"],
    };

    res.json(metadata);
  };
}
