/**
 * CORS middleware for Ailumina Bridge HTTP server
 */

import cors from 'cors';
import { AILUMINA_HTTP_CONFIG } from '../config/settings.js';

export const corsMiddleware = cors({
  origin: AILUMINA_HTTP_CONFIG.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});