/**
 * CORS middleware for Memory HTTP server
 *
 * When credentials are enabled, we cannot use "*" as the origin.
 * Instead, we dynamically allow the requesting origin if "*" is configured.
 */

import cors from 'cors';
import { MEMORY_HTTP_CONFIG } from '../config/settings.js';

// Parse comma-separated origins from config
const allowedOrigins = MEMORY_HTTP_CONFIG.corsOrigins;

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if wildcard is configured
    if (allowedOrigins.includes('*')) {
      console.warn(`⚠️  CORS: Allowing origin ${origin} (wildcard enabled)`);
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check for wildcard patterns (e.g., https://*.symagenic.com)
    const allowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return false;
    });

    if (allowed) {
      return callback(null, true);
    }

    // Log blocked origin
    console.error(`❌ CORS: Blocked origin ${origin}`);
    console.error(`   Allowed origins: ${allowedOrigins.join(', ')}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});