/**
 * Authentication middleware for Memory HTTP server
 * Supports both OAuth 2.1 JWT tokens and simple bearer tokens
 */

import type { Request, Response, NextFunction } from 'express';
import { MEMORY_HTTP_CONFIG } from '../config/settings.js';
import { MEMORY_OAUTH_CONFIG } from '../config/oauth-config.js';
import type { OAuthRequest } from './oauth.js';

/**
 * Send 401 Unauthorized response with appropriate WWW-Authenticate header
 * Per RFC 9728 Section 5.1, this header helps clients discover OAuth metadata
 */
function sendUnauthorized(res: Response): void {
  const headers: Record<string, string> = {};

  // If OAuth is enabled, include resource metadata location
  if (MEMORY_OAUTH_CONFIG.enabled) {
    // Construct the metadata URL
    const metadataUrl = `${MEMORY_OAUTH_CONFIG.resourceId}/.well-known/oauth-protected-resource`;
    headers['WWW-Authenticate'] = `Bearer resource_metadata="${metadataUrl}"`;
  } else {
    // Simple bearer token authentication
    headers['WWW-Authenticate'] = 'Bearer realm="Memory System"';
  }

  res.set(headers);
  res.status(401).json({
    error: 'unauthorized',
    message: MEMORY_OAUTH_CONFIG.enabled
      ? 'Valid OAuth access token or bearer token required'
      : 'Bearer token required for Memory system access',
  });
}

/**
 * Enhanced authentication middleware
 *
 * Authentication priority:
 * 1. If OAuth is enabled and JWT is valid (req.oauth populated), allow access
 * 2. Otherwise, fall back to simple bearer token validation
 * 3. If both fail or no auth provided, return 401
 *
 * This middleware runs AFTER oauthMiddleware, which populates req.oauth
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth if both OAuth and bearer token auth are disabled
  if (!MEMORY_HTTP_CONFIG.auth.enabled && !MEMORY_OAUTH_CONFIG.enabled) {
    return next();
  }

  const oauthReq = req as OAuthRequest;

  // Priority 1: Check OAuth authentication
  // If OAuth is enabled and the request has valid OAuth credentials, allow access
  if (MEMORY_OAUTH_CONFIG.enabled && oauthReq.oauth) {
    // OAuth validation succeeded (done by oauthMiddleware)
    console.log(`[Auth] OAuth authenticated: ${oauthReq.oauth.payload.sub || 'unknown'} (scopes: ${oauthReq.oauth.scopes.join(', ')})`);
    return next();
  }

  // Priority 2: Fall back to simple bearer token authentication
  // This maintains backward compatibility with existing deployments
  if (MEMORY_HTTP_CONFIG.auth.enabled) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendUnauthorized(res);
    }

    const token = authHeader.replace('Bearer ', '');

    if (token === MEMORY_HTTP_CONFIG.auth.bearerToken) {
      // Simple bearer token valid
      console.log('[Auth] Bearer token authenticated');
      return next();
    }

    // If we get here with a JWT-looking token, OAuth validation failed
    if (token.split('.').length === 3 && MEMORY_OAUTH_CONFIG.enabled) {
      console.warn('[Auth] JWT token present but OAuth validation failed');
    }
  }

  // Both OAuth and bearer token authentication failed (or not provided)
  sendUnauthorized(res);
};