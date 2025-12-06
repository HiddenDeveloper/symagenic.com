# OAuth 2.1 Setup for AI Memory MCP

This guide explains how to set up OAuth 2.1 authentication for the AI Memory MCP server, making it compatible as an Anthropic Claude connector.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start with Tailscale](#quick-start-with-tailscale)
5. [Authorization Server Setup](#authorization-server-setup)
6. [MCP Server Configuration](#mcp-server-configuration)
7. [Testing OAuth Flow](#testing-oauth-flow)
8. [Claude Connector Setup](#claude-connector-setup)
9. [Troubleshooting](#troubleshooting)

## Overview

The AI Memory MCP server implements OAuth 2.1 following the MCP specification 2025-06-18 (RFC 9728). It acts as an **OAuth Resource Server**, validating JWT tokens from trusted authorization servers.

### Key Features

- ✅ OAuth 2.1 compliance (RFC 9728)
- ✅ JWT token validation with JWKS
- ✅ Bearer token fallback for backward compatibility
- ✅ Tailscale HTTPS support (no SSL code in app)
- ✅ Dynamic authorization server discovery
- ✅ Scope-based authorization ready
- ✅ Token caching for performance

## Architecture

```
┌─────────────────┐
│  Anthropic      │
│  Claude Client  │
└────────┬────────┘
         │ 1. Request with no token
         ▼
┌─────────────────────────────────────┐
│  Tailscale HTTPS Reverse Proxy      │
│  (handles SSL/TLS)                  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  AI Memory MCP Server               │
│  - Returns 401 + WWW-Authenticate   │
│  - Points to metadata endpoint      │
└────────┬────────────────────────────┘
         │
         │ 2. Client discovers OAuth endpoints
         │    via /.well-known/oauth-protected-resource
         │
         ▼
┌─────────────────────────────────────┐
│  Authorization Server (Logto/etc)   │
│  - Issues JWT tokens                │
│  - Provides JWKS endpoint           │
└─────────────────────────────────────┘
         │
         │ 3. Client gets token
         │
         ▼
┌─────────────────────────────────────┐
│  AI Memory MCP Server               │
│  - Validates JWT signature          │
│  - Checks audience & issuer         │
│  - Grants access                    │
└─────────────────────────────────────┘
```

## Prerequisites

1. **Tailscale Network**: Active Tailscale network with access
2. **Authorization Server**: One of:
   - Logto (recommended for simplicity)
   - Auth0
   - Keycloak
   - Self-hosted OAuth server
3. **Domain/URL**: Your Tailscale MagicDNS URL or custom domain

## Quick Start with Tailscale

### Step 1: Expose Server via Tailscale

```bash
# Start the MCP server (HTTP, no SSL)
cd packages/ai-memory-mcp
npm run dev:http

# In another terminal, expose via Tailscale with HTTPS
tailscale serve https / http://localhost:3003
```

Your server is now available at:
- `https://<machine-name>.<tailscale-network>.ts.net`

### Step 2: Set Up Authorization Server

#### Option A: Logto (Recommended)

1. **Create Logto Account**:
   - Visit https://logto.io
   - Sign up for free tier
   - Create a new tenant

2. **Create Machine-to-Machine Application**:
   ```
   Applications → Create Application
   → Select "Machine to Machine"
   → Name: "AI Memory MCP"
   ```

3. **Configure Application**:
   - **Redirect URIs**: `https://claude.ai/api/mcp/auth_callback`
   - **Grant Types**:
     - Authorization Code
     - Refresh Token
   - **Resource Indicator**: Your Tailscale URL
   - **Scopes**:
     - `read:memory`
     - `write:memory`

4. **Get Configuration**:
   - **Issuer URL**: `https://your-tenant.logto.app`
   - **Client ID**: From application page
   - **Client Secret**: From application page

#### Option B: Self-Hosted Minimal OAuth

For single-user scenarios, you can run a minimal OAuth server:

```bash
# Clone minimal OAuth server
git clone https://github.com/panva/node-oidc-provider
cd node-oidc-provider

# Configure for your use case
# See example-minimal.js for simple setup
```

### Step 3: Configure MCP Server

Edit `docker-compose.yml` or create `.env`:

```bash
# Enable OAuth
MEMORY_OAUTH_ENABLED=true

# Your Tailscale HTTPS URL
MEMORY_RESOURCE_ID=https://memory.your-tailscale-network.ts.net

# Your authorization server(s) - comma separated
MEMORY_AUTH_SERVERS=https://your-tenant.logto.app

# Scopes (default is fine)
MEMORY_OAUTH_SCOPES=read:memory,write:memory

# JWT validation settings (defaults are fine)
MEMORY_JWT_CLOCK_TOLERANCE=30
MEMORY_JWKS_CACHE_TTL=3600
MEMORY_TOKEN_CACHE_TTL=300

# Keep bearer token for fallback (optional)
MEMORY_AUTH_ENABLED=true
MEMORY_AUTH_TOKEN=your-static-token-here
```

### Step 4: Restart Services

```bash
# Using Docker Compose
docker-compose down
docker-compose up -d ai-memory-mcp

# Or development mode
npm run dev:oauth
```

You should see:

```
🧠 Memory HTTP Server listening on http://0.0.0.0:3003
🔐 Authentication:
   ✓ OAuth 2.1: Enabled
   ✓ Resource ID: https://memory.your-tailscale-network.ts.net
   ✓ Auth Servers: https://your-tenant.logto.app
   ✓ Scopes: read:memory,write:memory
   ✓ Metadata: https://memory.your-tailscale-network.ts.net/.well-known/oauth-protected-resource
   ✓ Bearer Token: Enabled (fallback)
```

## MCP Server Configuration

### Environment Variables

All OAuth configuration is done via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEMORY_OAUTH_ENABLED` | Yes | `false` | Enable OAuth authentication |
| `MEMORY_RESOURCE_ID` | Yes | - | Canonical URL of this MCP server |
| `MEMORY_AUTH_SERVERS` | Yes | - | Comma-separated list of trusted auth servers |
| `MEMORY_OAUTH_SCOPES` | No | `read:memory,write:memory` | Supported OAuth scopes |
| `MEMORY_JWT_CLOCK_TOLERANCE` | No | `30` | Clock skew tolerance (seconds) |
| `MEMORY_JWKS_CACHE_TTL` | No | `3600` | JWKS cache duration (seconds) |
| `MEMORY_TOKEN_CACHE_TTL` | No | `300` | Token cache duration (seconds) |

### Scopes

Currently supported scopes:

- **`read:memory`**: Query and retrieve memory data
- **`write:memory`**: Create and update memory nodes
- **`admin:memory`**: Administrative operations (future use)

Scope validation is implemented but currently all-or-nothing (you need valid token, scopes not yet enforced per endpoint).

## Testing OAuth Flow

### 1. Test Metadata Endpoint

```bash
curl https://memory.your-tailscale-network.ts.net/.well-known/oauth-protected-resource
```

Expected response:

```json
{
  "resource": "https://memory.your-tailscale-network.ts.net",
  "authorization_servers": ["https://your-tenant.logto.app"],
  "scopes_supported": ["read:memory", "write:memory"],
  "bearer_methods_supported": ["header"],
  "mcp_version": "2025-06-18",
  "token_endpoint_auth_methods_supported": [
    "client_secret_basic",
    "client_secret_post",
    "none"
  ]
}
```

### 2. Test Unauthorized Access

```bash
curl https://memory.your-tailscale-network.ts.net/health
```

Expected response:

```json
{
  "error": "unauthorized",
  "message": "Valid OAuth access token or bearer token required"
}
```

With header:

```http
WWW-Authenticate: Bearer resource_metadata="https://memory.your-tailscale-network.ts.net/.well-known/oauth-protected-resource"
```

### 3. Get OAuth Token with MCP Inspector

The official MCP Inspector helps with OAuth flow:

```bash
npx @modelcontextprotocol/inspector
```

1. Select **Streamable HTTP** transport
2. Enter server URL: `https://memory.your-tailscale-network.ts.net`
3. Click **Open Auth Settings** → **Quick OAuth Flow**
4. Complete authorization in browser
5. Copy the `access_token` from inspector

### 4. Test Authenticated Request

```bash
TOKEN="your-jwt-token-here"

curl -H "Authorization: Bearer $TOKEN" \
  https://memory.your-tailscale-network.ts.net/health
```

Expected: `200 OK` with health status

## Claude Connector Setup

### Step 1: Prepare Configuration

You need:
- **Server URL**: `https://memory.your-tailscale-network.ts.net`
- **Access Token**: From MCP Inspector OAuth flow
- **Transport**: Streamable HTTP (recommended) or SSE

### Step 2: Add to Claude

In Claude's MCP configuration:

```json
{
  "mcpServers": {
    "memory": {
      "type": "url",
      "url": "https://memory.your-tailscale-network.ts.net",
      "transport": "streamableHttp",
      "authorization_token": "YOUR_JWT_TOKEN_HERE"
    }
  }
}
```

### Step 3: Token Refresh

JWT tokens expire. Options:

1. **Manual refresh**: Use MCP Inspector to get new token, update config
2. **Long-lived tokens**: Configure auth server for longer expiration
3. **Refresh token flow**: Implement token refresh in your client (advanced)

### Step 4: Verify Connection

In Claude, the memory server tools should now be available:

- `get_schema`
- `semantic_search`
- `text_search`
- `execute_cypher`
- `system_status`
- `load_current_focus`

## Troubleshooting

### OAuth is enabled but not working

**Check logs**:

```bash
docker-compose logs ai-memory-mcp | grep -i oauth
```

**Verify configuration**:

```bash
# Should show OAuth settings on startup
docker-compose logs ai-memory-mcp | grep "OAuth 2.1"
```

### "Invalid issuer" error

The JWT token's `iss` claim doesn't match configured auth servers.

**Fix**:
1. Check `MEMORY_AUTH_SERVERS` matches authorization server exactly
2. No trailing slashes: `https://auth.example.com` not `https://auth.example.com/`

### "Invalid audience" error

The JWT token's `aud` claim doesn't match the resource ID.

**Fix**:
1. Check `MEMORY_RESOURCE_ID` matches your Tailscale URL exactly
2. Include `https://` scheme
3. When requesting token, use `resource` parameter with your resource ID

### Bearer token still works (want OAuth only)

Set `MEMORY_AUTH_ENABLED=false` to disable bearer token fallback.

### Token validation is slow

Increase cache TTLs:

```bash
MEMORY_JWKS_CACHE_TTL=7200     # 2 hours
MEMORY_TOKEN_CACHE_TTL=600     # 10 minutes
```

### "No authorization servers configured" error

You enabled OAuth but didn't set `MEMORY_AUTH_SERVERS`.

**Fix**:

```bash
MEMORY_AUTH_SERVERS=https://your-auth-server.com
```

### CORS errors from Claude

Verify CORS is enabled:

```bash
MEMORY_CORS_ORIGINS=*
```

Or specific origins:

```bash
MEMORY_CORS_ORIGINS=https://claude.ai,https://www.anthropic.com
```

## Security Best Practices

1. **Use HTTPS**: Always use Tailscale or proper SSL/TLS
2. **Validate audience**: Never skip audience validation
3. **Rotate tokens**: Use short-lived tokens with refresh flow
4. **Limit scopes**: Only grant necessary scopes
5. **Monitor logs**: Watch for failed authentication attempts
6. **Secure auth server**: Use reputable OAuth provider or properly configure self-hosted
7. **Network isolation**: Use Tailscale ACLs to restrict access

## Advanced Topics

### Multiple Authorization Servers

Support multiple OAuth providers:

```bash
MEMORY_AUTH_SERVERS=https://primary-auth.com,https://backup-auth.com
```

### Custom Scopes

Add custom scopes in `oauth-config.ts`:

```typescript
supportedScopes: [
  "read:memory",
  "write:memory",
  "admin:memory",
  "maintenance:memory"  // Custom scope
]
```

### Scope-Based Authorization

Require specific scopes for endpoints:

```typescript
import { requireScopes } from './middleware/oauth.js';

app.post('/admin/backup',
  oauthMiddleware,
  authMiddleware,
  requireScopes(['admin:memory']),
  backupHandler
);
```

## References

- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8707: Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [Logto Documentation](https://docs.logto.io)
- [MCP Inspector Tool](https://github.com/modelcontextprotocol/inspector)

## Support

For issues:
1. Check logs: `docker-compose logs ai-memory-mcp`
2. Verify configuration: Check all environment variables
3. Test metadata endpoint: Should return valid JSON
4. Use MCP Inspector: Helps debug OAuth flow
5. Query persistent memory: `/memory` for architecture decisions
