/**
 * Express server for Memory HTTP transport
 * Supports OAuth 2.1 and simple bearer token authentication
 */

import express from 'express';
import { MEMORY_HTTP_CONFIG } from './config/settings.js';
import { MEMORY_OAUTH_CONFIG, validateOAuthConfig } from './config/oauth-config.js';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { oauthMiddleware } from './middleware/oauth.js';
import { loggingMiddleware } from './middleware/logging.js';
import { mainRouter } from './routes/index.js';
import { wellKnownRouter } from './routes/well-known.js';

export class MemoryHttpServer {
  private app: express.Application;
  private server?: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Body parsing
    this.app.use(express.json());

    // CORS handling
    this.app.use(corsMiddleware);

    // Request logging
    this.app.use(loggingMiddleware);

    // Well-known endpoints (public, no auth required)
    // Must be registered before auth middleware
    this.app.use(wellKnownRouter);

    // OAuth JWT validation (populates req.oauth if valid)
    // Must run before auth middleware
    this.app.use(oauthMiddleware);

    // Authentication enforcement
    // Uses OAuth if available, falls back to bearer token
    this.app.use(authMiddleware);
  }

  private setupRoutes(): void {
    // Main MCP routes (protected by auth middleware)
    this.app.use('/', mainRouter);
    
    // 404 handler
    this.app.use('*', (req, res) => {
      const endpoints = [
        'GET / (server info)',
        'POST / (MCP JSON-RPC 2.0)',
        'GET /health',
        'GET /tools',
        'POST /tools/{name}'
      ];

      if (MEMORY_OAUTH_CONFIG.enabled) {
        endpoints.push('GET /.well-known/oauth-protected-resource');
      }

      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        available_endpoints: endpoints
      });
    });

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Memory HTTP Server Error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'Unknown error occurred'
      });
    });
  }

  async start(): Promise<void> {
    // Validate OAuth configuration if enabled
    if (MEMORY_OAUTH_CONFIG.enabled) {
      const validation = validateOAuthConfig();
      if (!validation.valid) {
        console.error('❌ OAuth configuration invalid:');
        validation.errors.forEach(error => console.error(`   - ${error}`));
        throw new Error('Invalid OAuth configuration');
      }
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(MEMORY_HTTP_CONFIG.port, MEMORY_HTTP_CONFIG.host, () => {
        console.log(`🧠 Memory HTTP Server listening on http://${MEMORY_HTTP_CONFIG.host}:${MEMORY_HTTP_CONFIG.port}`);
        console.log(`🚀 MCP Transport: Streamable HTTP (Claude.ai web & mobile compatible)`);
        console.log(`🔐 Authentication:`);

        if (MEMORY_OAUTH_CONFIG.enabled) {
          console.log(`   ✓ OAuth 2.1: Enabled`);
          console.log(`   ✓ Resource ID: ${MEMORY_OAUTH_CONFIG.resourceId}`);
          console.log(`   ✓ Auth Servers: ${MEMORY_OAUTH_CONFIG.authorizationServers.join(', ')}`);
          console.log(`   ✓ Scopes: ${MEMORY_OAUTH_CONFIG.supportedScopes.join(', ')}`);
          console.log(`   ✓ Metadata: ${MEMORY_OAUTH_CONFIG.resourceId}/.well-known/oauth-protected-resource`);
        }

        if (MEMORY_HTTP_CONFIG.auth.enabled) {
          console.log(`   ✓ Bearer Token: Enabled (fallback)`);
        }

        if (!MEMORY_OAUTH_CONFIG.enabled && !MEMORY_HTTP_CONFIG.auth.enabled) {
          console.log(`   ⚠️  No authentication enabled - open access!`);
        }

        resolve();
      });

      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${MEMORY_HTTP_CONFIG.port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🧠 Memory HTTP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}