/**
 * CORS middleware for Memory HTTP server
 */

import cors from 'cors';
import { RECALL_HTTP_CONFIG } from '../config/settings.js';

export const corsMiddleware = cors({
  origin: RECALL_HTTP_CONFIG.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});