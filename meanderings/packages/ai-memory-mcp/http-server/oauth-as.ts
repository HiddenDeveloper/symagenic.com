/**
 * OAuth 2.1 Authorization Server Implementation
 *
 * Implements MCP-compliant OAuth Authorization Server that delegates
 * authentication to third-party providers (Logto) while issuing its own tokens.
 *
 * This follows the MCP spec's "Third-Party Authorization Flow" where the MCP server
 * acts as BOTH an authorization server (to MCP clients) AND an OAuth client (to Logto).
 */

import { randomBytes } from 'crypto';
import { SignJWT, generateKeyPair, exportJWK, jwtVerify, type JWTPayload } from 'jose';
import { MEMORY_HTTP_CONFIG } from './config/settings.js';
import { MEMORY_OAUTH_CONFIG } from './config/oauth-config.js';

// ============================================================================
// Types
// ============================================================================

interface OAuthState {
  /** PKCE code challenge from original client request */
  codeChallenge: string;
  /** PKCE code challenge method */
  codeChallengeMethod: string;
  /** Original client redirect URI */
  redirectUri: string;
  /** Client ID */
  clientId: string;
  /** Requested scopes */
  scopes: string[];
  /** Requested resource */
  resource: string;
  /** Original state parameter from client (to return in callback) */
  clientState: string;
  /** Timestamp when state was created */
  createdAt: number;
}

interface TokenSession {
  /** Logto access token (for validation) */
  logtoToken: string;
  /** Logto token expiry */
  logtoExpiry: number;
  /** Scopes granted */
  scopes: string[];
  /** Subject (user ID from Logto) */
  sub: string;
  /** Resource this token is for */
  resource: string;
  /** Created timestamp */
  createdAt: number;
}

interface RegisteredClient {
  /** Client ID */
  client_id: string;
  /** Client secret (hashed for storage) */
  client_secret: string;
  /** Client name */
  client_name: string;
  /** Redirect URIs */
  redirect_uris: string[];
  /** Allowed grant types */
  grant_types: string[];
  /** Allowed scopes */
  scope?: string;
  /** Registration timestamp */
  client_id_issued_at: number;
  /** Secret expiry (0 = never expires) */
  client_secret_expires_at: number;
}

// ============================================================================
// RSA Keypair for JWT Signing
// ============================================================================

/** RSA keypair for signing JWTs */
let rsaKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null;

/** Key ID for JWKS */
const KEY_ID = 'memory-oauth-as-2025';

/** Algorithm for JWT signing */
const JWT_ALGORITHM = 'RS256';

/**
 * Generate RSA keypair for JWT signing (called at startup)
 */
async function initializeJWTKeys() {
  if (!rsaKeyPair) {
    console.log('[OAuth AS] Generating RSA keypair for JWT signing...');
    rsaKeyPair = await generateKeyPair(JWT_ALGORITHM);
    console.log(`[OAuth AS] RSA keypair generated (kid: ${KEY_ID})`);
  }
}

// Initialize keypair at module load
initializeJWTKeys().catch((err) => {
  console.error('[OAuth AS] Failed to initialize JWT keys:', err);
});

// ============================================================================
// In-Memory Storage (for MVP)
// ============================================================================

/** OAuth state storage (state -> OAuthState) */
const stateStore = new Map<string, OAuthState>();

/** Authorization code storage (code -> state + logto code) */
const codeStore = new Map<string, { state: string; logtoCode: string }>();

/** Token session storage (MCP access token -> TokenSession) - DEPRECATED: Using JWTs now */
const tokenStore = new Map<string, TokenSession>();

/** Registered client storage (client_id -> RegisteredClient) */
const clientStore = new Map<string, RegisteredClient>();

/** Cleanup interval - remove expired entries every 5 minutes */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Clean up expired entries */
function cleanup() {
  const now = Date.now();

  // Clean states
  for (const [state, data] of stateStore.entries()) {
    if (now - data.createdAt > STATE_TTL_MS) {
      stateStore.delete(state);
    }
  }

  // Clean codes
  for (const [code, data] of codeStore.entries()) {
    const stateData = stateStore.get(data.state);
    if (!stateData || now - stateData.createdAt > CODE_TTL_MS) {
      codeStore.delete(code);
    }
  }

  // Clean tokens
  for (const [token, session] of tokenStore.entries()) {
    if (now > session.logtoExpiry || now - session.createdAt > TOKEN_TTL_MS) {
      tokenStore.delete(token);
    }
  }
}

// Start cleanup interval
setInterval(cleanup, CLEANUP_INTERVAL_MS);

// ============================================================================
// Helper Functions
// ============================================================================

/** Generate secure random string */
function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Verify PKCE code challenge */
async function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): Promise<boolean> {
  if (method !== 'S256') {
    return false; // Only S256 is supported
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const challenge = Buffer.from(hash).toString('base64url');

  return challenge === codeChallenge;
}

/** Exchange Logto authorization code for token */
async function exchangeLogtoCode(code: string, state: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}> {
  const stateData = stateStore.get(state);
  if (!stateData) {
    throw new Error('Invalid state');
  }

  // Get Logto configuration
  const logtoIssuer = MEMORY_OAUTH_CONFIG.authorizationServers[0];
  if (!logtoIssuer) {
    throw new Error('No Logto issuer configured');
  }

  const tokenEndpoint = `${logtoIssuer}/token`;

  // Exchange code for token
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.LOGTO_CLIENT_ID || '',
      client_secret: process.env.LOGTO_CLIENT_SECRET || '',
      redirect_uri: `${MEMORY_OAUTH_CONFIG.oauthIssuer}/oauth/callback`,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[OAuth AS] Logto token exchange failed:', error);
    throw new Error('Failed to exchange Logto authorization code');
  }

  return await response.json();
}

// ============================================================================
// OAuth Authorization Server Endpoints
// ============================================================================

/**
 * POST /register
 *
 * Dynamic Client Registration endpoint (RFC 7591)
 * Allows MCP clients like Claude to dynamically register and obtain credentials
 */
export async function handleRegister(req: Request): Promise<Response> {
  try {
    const body = await req.json();

    // Validate required fields
    const { client_name, redirect_uris } = body;

    if (!client_name || !redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return Response.json({
        error: 'invalid_request',
        error_description: 'client_name and redirect_uris are required',
      }, { status: 400 });
    }

    // Validate redirect URIs
    for (const uri of redirect_uris) {
      try {
        new URL(uri);
      } catch {
        return Response.json({
          error: 'invalid_redirect_uri',
          error_description: `Invalid redirect URI: ${uri}`,
        }, { status: 400 });
      }
    }

    // Generate client credentials
    const client_id = generateSecureToken(24);
    const client_secret = generateSecureToken(32);
    const client_id_issued_at = Math.floor(Date.now() / 1000);

    // Store registered client
    const registeredClient: RegisteredClient = {
      client_id,
      client_secret,
      client_name,
      redirect_uris,
      grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
      scope: body.scope,
      client_id_issued_at,
      client_secret_expires_at: 0, // Never expires
    };

    clientStore.set(client_id, registeredClient);

    console.log(`[OAuth AS] Registered new client: ${client_name} (${client_id})`);

    // Return client credentials (RFC 7591 response)
    return Response.json({
      client_id,
      client_secret,
      client_id_issued_at,
      client_secret_expires_at: 0,
      client_name,
      redirect_uris,
      grant_types: registeredClient.grant_types,
      ...(body.scope && { scope: body.scope }),
    }, { status: 201 });
  } catch (error) {
    console.error('[OAuth AS] Registration error:', error);
    return Response.json({
      error: 'server_error',
      error_description: 'Failed to register client',
    }, { status: 500 });
  }
}

/**
 * GET /.well-known/oauth-authorization-server
 *
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * This tells MCP clients where our authorization endpoints are
 */
export function handleOAuthServerMetadata(): Response {
  const issuer = MEMORY_OAUTH_CONFIG.oauthIssuer;

  const metadata = {
    issuer: issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`, // Dynamic Client Registration
    jwks_uri: `${issuer}/.well-known/jwks.json`, // JWKS for JWT validation
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    // Advertise ALL scopes across all MCP resources
    scopes_supported: MEMORY_OAUTH_CONFIG.getAllScopes(),
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none',
    ],
  };

  return Response.json(metadata);
}

/**
 * GET /.well-known/jwks.json
 *
 * JSON Web Key Set (JWKS) endpoint
 * Exposes public key for JWT signature verification by resource servers
 */
export async function handleJWKS(): Promise<Response> {
  if (!rsaKeyPair) {
    return Response.json({
      error: 'server_not_ready',
      error_description: 'JWT keypair not initialized',
    }, { status: 503 });
  }

  try {
    // Export public key as JWK
    const publicJWK = await exportJWK(rsaKeyPair.publicKey);

    // JWKS format (array of keys)
    const jwks = {
      keys: [
        {
          ...publicJWK,
          kid: KEY_ID,
          alg: JWT_ALGORITHM,
          use: 'sig',
        },
      ],
    };

    return Response.json(jwks, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[OAuth AS] Failed to export JWKS:', error);
    return Response.json({
      error: 'server_error',
      error_description: 'Failed to generate JWKS',
    }, { status: 500 });
  }
}

/**
 * GET /authorize
 *
 * Authorization endpoint - initiates OAuth flow
 * Redirects to Logto for actual authentication, then back to /oauth/callback
 */
export function handleAuthorize(req: Request): Response {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Extract OAuth parameters
  const responseType = params.get('response_type');
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const state = params.get('state');
  const codeChallenge = params.get('code_challenge');
  const codeChallengeMethod = params.get('code_challenge_method');
  const scope = params.get('scope') || '';
  const resource = params.get('resource') || MEMORY_OAUTH_CONFIG.resourceId;

  // Validate required parameters
  if (responseType !== 'code') {
    return new Response('Unsupported response_type', { status: 400 });
  }

  if (!clientId || !redirectUri || !state || !codeChallenge) {
    return new Response('Missing required parameters', { status: 400 });
  }

  if (codeChallengeMethod !== 'S256') {
    return new Response('Only S256 code_challenge_method is supported', { status: 400 });
  }

  // Validate client_id and redirect_uri
  const client = clientStore.get(clientId);
  if (client) {
    // Client is registered - validate redirect_uri
    if (!client.redirect_uris.includes(redirectUri)) {
      console.warn(`[OAuth AS] Invalid redirect_uri for client ${clientId}: ${redirectUri}`);
      return new Response('Invalid redirect_uri', { status: 400 });
    }
  } else {
    // Client not registered - log warning but allow (for PKCE public clients)
    console.warn(`[OAuth AS] Unregistered client attempting authorization: ${clientId}`);
  }

  // Store OAuth state
  const oauthState = generateSecureToken();
  stateStore.set(oauthState, {
    codeChallenge,
    codeChallengeMethod,
    redirectUri,
    clientId,
    scopes: scope.split(' ').filter(Boolean),
    resource,
    clientState: state, // Store original state from client to return later
    createdAt: Date.now(),
  });

  console.log(`[OAuth AS] Authorization request from client ${clientId}`);
  console.log(`[OAuth AS] Scopes requested: ${scope}`);
  console.log(`[OAuth AS] Resource requested: ${resource}`);
  console.log(`[OAuth AS] Redirect URI: ${redirectUri}`);

  // Redirect to Logto for authentication
  const logtoIssuer = MEMORY_OAUTH_CONFIG.authorizationServers[0];
  const logtoAuthUrl = new URL(`${logtoIssuer}/auth`);

  const logtoRedirectUri = `${MEMORY_OAUTH_CONFIG.oauthIssuer}/oauth/callback`;
  // Only request standard OIDC scopes from Logto (not resource-specific scopes)
  // Logto doesn't know about 'read:memory' or 'write:memory' - those are MCP-specific
  const logtoScope = 'openid profile email';

  logtoAuthUrl.searchParams.set('response_type', 'code');
  logtoAuthUrl.searchParams.set('client_id', process.env.LOGTO_CLIENT_ID || '');
  logtoAuthUrl.searchParams.set('redirect_uri', logtoRedirectUri);
  logtoAuthUrl.searchParams.set('scope', logtoScope);
  logtoAuthUrl.searchParams.set('state', oauthState);
  // Note: We don't pass 'resource' or custom scopes to Logto
  // Logto handles authentication only - MCP server handles authorization

  console.log(`[OAuth AS] Logto auth parameters:`, {
    client_id: process.env.LOGTO_CLIENT_ID,
    redirect_uri: logtoRedirectUri,
    scope: logtoScope,
    state: oauthState.substring(0, 10) + '...',
  });
  console.log(`[OAuth AS] Redirecting to Logto: ${logtoAuthUrl.toString().substring(0, 100)}...`);

  return Response.redirect(logtoAuthUrl.toString(), 302);
}

/**
 * GET /oauth/callback
 *
 * Callback from Logto after user authentication
 * Exchanges Logto code for token, then redirects back to original client
 */
export async function handleOAuthCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  const errorUri = params.get('error_uri');

  // Handle Logto errors
  if (error) {
    console.error('[OAuth AS] Logto returned error:', {
      error,
      error_description: errorDescription,
      error_uri: errorUri,
      state,
    });
    const message = errorDescription
      ? `Authentication failed: ${error} - ${errorDescription}`
      : `Authentication failed: ${error}`;
    return new Response(message, { status: 400 });
  }

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  // Retrieve original OAuth state
  const oauthState = stateStore.get(state);
  if (!oauthState) {
    return new Response('Invalid or expired state', { status: 400 });
  }

  console.log(`[OAuth AS] Logto callback received for client ${oauthState.clientId}`);

  try {
    // Exchange Logto code for Logto token
    const logtoToken = await exchangeLogtoCode(code, state);
    console.log(`[OAuth AS] Successfully exchanged Logto code for token`);

    // Generate MCP authorization code
    const mcpCode = generateSecureToken();
    codeStore.set(mcpCode, {
      state,
      logtoCode: logtoToken.access_token,
    });
    console.log(`[OAuth AS] Stored code ${mcpCode.substring(0, 20)}... for state ${state.substring(0, 20)}...`);
    console.log(`[OAuth AS] Code store now has ${codeStore.size} entries`);

    // Note: Don't delete state yet - we need it for the /token endpoint
    // State will be cleaned up after token exchange

    // Redirect back to original client with MCP authorization code
    const redirectUrl = new URL(oauthState.redirectUri);
    redirectUrl.searchParams.set('code', mcpCode);
    redirectUrl.searchParams.set('state', oauthState.clientState); // Return original client state

    console.log(`[OAuth AS] Redirecting to client: ${redirectUrl.toString().substring(0, 100)}...`);

    return Response.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    console.error('[OAuth AS] Failed to exchange Logto code:', error);
    return new Response('Failed to complete authentication', { status: 500 });
  }
}

/**
 * POST /token
 *
 * Token endpoint - exchanges authorization code for access token
 * Issues MCP access token bound to Logto session
 */
export async function handleToken(req: Request): Promise<Response> {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const grantType = params.get('grant_type');
    const code = params.get('code');
    const codeVerifier = params.get('code_verifier');
    let clientId: string | null = params.get('client_id');
    let clientSecret: string | null = params.get('client_secret');

    // Check for HTTP Basic Auth (client_secret_basic)
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Basic ')) {
      try {
        const base64Credentials = authHeader.substring(6);
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [id, secret] = credentials.split(':');
        clientId = id || null;
        clientSecret = secret || null;
      } catch {
        return Response.json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials',
        }, { status: 401 });
      }
    }

    // Validate parameters
    if (grantType !== 'authorization_code') {
      return Response.json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code grant type is supported',
      }, { status: 400 });
    }

    if (!code || !codeVerifier || !clientId) {
      return Response.json({
        error: 'invalid_request',
        error_description: 'Missing required parameters',
      }, { status: 400 });
    }

    console.log(`[OAuth AS] Token request - code: ${code?.substring(0, 20)}...`);
    console.log(`[OAuth AS] Code store has ${codeStore.size} entries`);
    console.log(`[OAuth AS] Code store keys: ${Array.from(codeStore.keys()).map(k => k.substring(0, 20)).join(', ')}`)

    // Validate client credentials if provided
    const client = clientStore.get(clientId);
    if (client && clientSecret) {
      // Client is registered and provided credentials - validate them
      if (client.client_secret !== clientSecret) {
        console.warn(`[OAuth AS] Invalid client_secret for client ${clientId}`);
        return Response.json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials',
        }, { status: 401 });
      }
      console.log(`[OAuth AS] Client authenticated: ${client.client_name}`);
    } else if (client && !clientSecret) {
      // Registered client but no secret provided - this is okay for PKCE
      console.log(`[OAuth AS] PKCE authentication for registered client: ${client.client_name}`);
    } else {
      // Unregistered client - allow if using PKCE
      console.log(`[OAuth AS] Unregistered client using PKCE: ${clientId}`);
    }

    // Retrieve authorization code data
    const codeData = codeStore.get(code);
    if (!codeData) {
      return Response.json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code',
      }, { status: 400 });
    }

    console.log(`[OAuth AS] Code data state: ${codeData.state}`);
    console.log(`[OAuth AS] State store keys: ${Array.from(stateStore.keys()).join(', ')}`);

    const stateData = stateStore.get(codeData.state);
    if (!stateData) {
      console.error(`[OAuth AS] State not found for: ${codeData.state}`);
      return Response.json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired state',
      }, { status: 400 });
    }

    // Verify PKCE
    const pkceValid = await verifyPKCE(
      codeVerifier,
      stateData.codeChallenge,
      stateData.codeChallengeMethod
    );

    if (!pkceValid) {
      console.warn('[OAuth AS] PKCE verification failed');
      return Response.json({
        error: 'invalid_grant',
        error_description: 'PKCE verification failed',
      }, { status: 400 });
    }

    console.log(`[OAuth AS] PKCE verified successfully for client ${clientId}`);

    // Ensure JWT keypair is ready
    if (!rsaKeyPair) {
      return Response.json({
        error: 'server_error',
        error_description: 'JWT keypair not initialized',
      }, { status: 500 });
    }

    // Generate JWT access token with proper claims
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600; // 1 hour

    const mcpToken = await new SignJWT({
      scope: stateData.scopes.join(' '),
      client_id: clientId,
    })
      .setProtectedHeader({ alg: JWT_ALGORITHM, kid: KEY_ID })
      .setIssuedAt(now)
      .setIssuer(MEMORY_OAUTH_CONFIG.oauthIssuer)
      .setAudience(stateData.resource) // Resource this token is for
      .setSubject(clientId) // Subject is the client
      .setExpirationTime(now + expiresIn)
      .setJti(generateSecureToken(16)) // Unique token ID
      .sign(rsaKeyPair.privateKey);

    // Clean up authorization code (single use)
    codeStore.delete(code);

    console.log(`[OAuth AS] Issued JWT access token for client ${clientId}`);
    console.log(`[OAuth AS] Audience: ${stateData.resource}`);
    console.log(`[OAuth AS] Scopes: ${stateData.scopes.join(', ')}`);

    // Return token response
    return Response.json({
      access_token: mcpToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: stateData.scopes.join(' '),
    });
  } catch (error) {
    console.error('[OAuth AS] Token endpoint error:', error);
    return Response.json({
      error: 'server_error',
      error_description: 'Internal server error',
    }, { status: 500 });
  }
}

/**
 * Validate MCP JWT access token issued by this authorization server
 * Returns token session if valid, null if invalid
 */
export async function validateMCPToken(token: string): Promise<TokenSession | null> {
  if (!rsaKeyPair) {
    console.warn('[OAuth AS] Cannot validate token: JWT keypair not initialized');
    return null;
  }

  try {
    // Verify JWT signature and claims
    const { payload } = await jwtVerify(token, rsaKeyPair.publicKey, {
      issuer: MEMORY_OAUTH_CONFIG.oauthIssuer,
      // Note: We don't validate audience here - let the resource server do that
      // This function is called by THIS server (memory), so audience might be different resources
    });

    // Extract session information from JWT claims
    const session: TokenSession = {
      logtoToken: '', // Not needed for JWT-based tokens
      logtoExpiry: (payload.exp || 0) * 1000, // Convert to milliseconds
      scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
      sub: payload.sub || '',
      resource: typeof payload.aud === 'string' ? payload.aud : (Array.isArray(payload.aud) ? (payload.aud[0] || '') : ''),
      createdAt: (payload.iat || 0) * 1000, // Convert to milliseconds
    };

    return session;
  } catch (error) {
    // JWT verification failed (expired, invalid signature, etc.)
    console.debug('[OAuth AS] Token validation failed:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}
