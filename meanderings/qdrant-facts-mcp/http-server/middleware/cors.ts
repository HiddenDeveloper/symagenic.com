/**
 * CORS middleware for Qdrant Facts HTTP server
 */

import cors from 'cors';
import { FACTS_HTTP_CONFIG } from '../config/settings.js';

export const corsMiddleware = FACTS_HTTP_CONFIG.cors.enabled
  ? cors({
      origin: FACTS_HTTP_CONFIG.cors.origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  : cors({ origin: false });
