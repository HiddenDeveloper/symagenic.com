import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
// eslint-disable-next-line no-restricted-syntax
import { createServer as createHttpServer, Server } from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { config } from './config/settings.js';
import { loggingMiddleware } from './middleware/logging.js';
import { AgentWebSocketHandler } from '../websockets/agent.js';
import { TTSWebSocketHandler } from '../websockets/tts.js';
import { MCPClientManager } from '../shared/tools/mcp-manager.js';
import { mcpRouter } from './routes/mcp.js';
import { consciousnessRouter } from './routes/consciousness.js';
import { toolsCrudRouter } from './routes/tools-crud.js';
import { agentsCrudRouter } from './routes/agents-crud.js';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AppState {
  logger: winston.Logger;
  sessionId: string;
  startTime: Date;
  mcpManager?: MCPClientManager;
}

export function createServer(
  logger: winston.Logger,
  mcpManager?: MCPClientManager
): { app: Express; server: Server; wss: WebSocketServer } {
  const app = express();
  const server = createHttpServer(app);

  // Initialize WebSocket server
  const wss = new WebSocketServer({
    server,
    // Remove path restriction to handle all WebSocket connections
  });

  // Generate session ID
  const sessionId = randomUUID();

  // Initialize app state
  const appState: AppState = {
    logger,
    sessionId,
    startTime: new Date(),
    mcpManager,
  };

  // Initialize AgentFactory - Temporarily disabled while migrating to dynamic tool system
  try {
    // AgentFactory.initialize(); // TODO: Update AgentFactory to use new dynamic tool system
    logger.info('AgentFactory initialization skipped - using dynamic tool system');

    // Log placeholder agents info
    logger.info('Available agents: Using agents.json configuration directly');
    logger.info('Environment status: Using ServiceFactory.checkEnvironmentVariables()');
  } catch (error) {
    logger.error('Failed to initialize AgentFactory:', error);
    // Don't throw error to allow server to continue with dynamic tool system
  }

  // Store state in app locals for access in routes
  app.locals.state = appState;
  app.locals.wss = wss;

  // Security headers - must be before other middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "blob:"],  // Allow blob: for web workers
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        workerSrc: ["'self'", "blob:"],  // Explicit worker-src for web workers
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true
  }));

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  if (config.corsEnabled) {
    app.use(
      cors({
        origin: config.corsOrigins === '*' ? '*' : config.corsOrigins.split(','),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );
  }

  app.use(loggingMiddleware(logger));

  // API Routes
  app.use('/api/mcp', mcpRouter);
  app.use('/api/consciousness', consciousnessRouter);
  app.use('/api/tools', toolsCrudRouter);
  app.use('/api/agents', agentsCrudRouter);

  // Static file serving - updated for monorepo structure
  const baseDir = resolve(__dirname, '../../..');
  const uiPath = join(baseDir, 'client/dist');
  const testingPath = join(baseDir, 'client/public/testing-platform');

  // Serve main UI at root
  if (existsSync(uiPath)) {
    app.get('/', (req: Request, res: Response) => {
      res.sendFile(join(uiPath, 'index.html'));
    });

    // Mount static assets
    app.use('/assets', express.static(join(uiPath, 'assets')));
    app.use(express.static(uiPath)); // For favicon, etc.

    logger.info(`Serving main UI from: ${uiPath}`);
  } else {
    // Fallback API endpoint if no UI build
    app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'AIlumina API MCP Server',
        version: '1.0.0',
        description: 'TypeScript implementation of consciousness research platform API',
        available_agents: ['Temporarily using agents.json directly'],
        consciousness_agents: ['Using dynamic tool system'],
        environment_status: { status: 'Using ServiceFactory for env checks' },
        endpoints: {
          health: '/health',
          websocket: {
            agents: '/ws/{agent_type} - Using agents.json configuration',
          },
        },
      });
    });

    logger.warn(`UI build not found at: ${uiPath} - serving API info instead`);
  }

  // Serve testing UI at /testing
  if (existsSync(testingPath)) {
    app.get('/testing', (req: Request, res: Response) => {
      res.sendFile(join(testingPath, 'index.html'));
    });

    // Mount testing assets
    app.use('/testing/assets', express.static(join(testingPath, 'assets')));
    app.use('/testing', express.static(testingPath));

    logger.info(`Serving testing UI from: ${testingPath}`);
  } else {
    logger.info(`Testing UI build not found at: ${testingPath}`);
  }

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sessionId: appState.sessionId,
      uptime: process.uptime(),
    });
  });

  // Favicon route
  app.get('/favicon.ico', (req: Request, res: Response) => {
    const clientDir = resolve(__dirname, '../../..');
    const faviconPath = join(clientDir, 'client/public/favicon.svg');
    
    if (existsSync(faviconPath)) {
      res.type('image/svg+xml');
      res.sendFile(faviconPath);
    } else {
      // Fallback: generate a simple icon
      res.type('image/svg+xml');
      res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="#4f46e5" stroke="#e5e7eb" stroke-width="2"/>
        <circle cx="12" cy="13" r="2" fill="white"/>
        <circle cx="20" cy="13" r="2" fill="white"/>
        <path d="M12 20c1 2 3 2 4 2s3 0 4-2" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>`);
    }
  });

  // WebSocket connection handler
  wss.on('connection', (ws, req) => {
    const path = req.url;
    logger.info(`WebSocket connection established: ${path}`);

    // Route WebSocket connections based on path
    // Handle both /ws/endpoint (direct) and /endpoint (via Tailscale proxy that strips /ws)
    const pathWithWs = path?.startsWith('/ws/') ? path : `/ws${path}`;

    if (pathWithWs.startsWith('/ws/')) {
      const pathParts = pathWithWs.split('/');
      if (pathParts.length >= 3) {
        const endpoint = pathParts[2]; // Extract endpoint from /ws/{endpoint}

        if (endpoint === 'tts') {
          // Handle TTS WebSocket
          TTSWebSocketHandler.handleConnection(logger, ws);
        } else {
          // Handle agent WebSocket (original functionality)
          AgentWebSocketHandler.handleConnection(logger, ws, endpoint);
        }
      } else {
        ws.close(1008, 'Invalid WebSocket path format. Expected: /ws/{endpoint} or /{endpoint}');
      }
    } else {
      ws.close(1008, 'Invalid WebSocket path. Expected: /ws/{endpoint} or /{endpoint}');
    }
  });

  // Error handling middleware

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
    });
  });

  logger.info(`AIlumina API MCP Server initialized successfully`);
  logger.info(`Session ID: ${sessionId}`);

  return { app, server, wss };
}
