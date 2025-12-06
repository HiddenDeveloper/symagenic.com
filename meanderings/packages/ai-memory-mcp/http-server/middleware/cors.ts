/**
 * CORS middleware for Memory HTTP server
 *
 * When credentials are enabled, we cannot use "*" as the origin.
 * Instead, we dynamically allow the requesting origin if "*" is configured.
 */

import cors from 'cors';
import { MEMORY_HTTP_CONFIG } from '../config/settings.js';

// Handle wildcard origin with credentials
// When "*" is in the allowed origins and credentials are enabled,
// we need to dynamically reflect the requesting origin
const originConfig =
  MEMORY_HTTP_CONFIG.corsOrigins.includes('*')
    ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Always allow any origin when wildcard is configured
        callback(null, true);
      }
    : MEMORY_HTTP_CONFIG.corsOrigins;

export const corsMiddleware = cors({
  origin: originConfig,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});