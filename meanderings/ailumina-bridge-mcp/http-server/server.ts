/**
 * Express server for Ailumina Bridge HTTP transport
 */

import express from 'express';
import { AILUMINA_HTTP_CONFIG } from './config/settings.js';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import { loggingMiddleware } from './middleware/logging.js';
import { mainRouter } from './routes/index.js';

export class AiluminaHttpServer {
  private app: express.Application;
  private server?: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(corsMiddleware);
    this.app.use(loggingMiddleware);
    this.app.use(authMiddleware);
  }

  private setupRoutes(): void {
    this.app.use('/', mainRouter);
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        available_endpoints: ['/health', '/tools', '/ (MCP JSON-RPC 2.0)']
      });
    });

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Ailumina HTTP Server Error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'Unknown error occurred'
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(AILUMINA_HTTP_CONFIG.port, AILUMINA_HTTP_CONFIG.host, () => {
        console.log(`🌐 Ailumina Bridge HTTP Server listening on http://${AILUMINA_HTTP_CONFIG.host}:${AILUMINA_HTTP_CONFIG.port}`);
        console.log(`🔐 Authentication: ${AILUMINA_HTTP_CONFIG.auth.enabled ? 'Enabled' : 'Disabled'}`);
        resolve();
      });

      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${AILUMINA_HTTP_CONFIG.port} is already in use`));
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
          console.log('🌐 Ailumina Bridge HTTP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}