/**
 * Authentication middleware for Qdrant Facts HTTP server
 */

import { Request, Response, NextFunction } from 'express';
import { FACTS_HTTP_CONFIG } from '../config/settings.js';

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = ['/health', '/'];

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if disabled
  if (!FACTS_HTTP_CONFIG.auth.enabled) {
    return next();
  }

  // Skip auth for public endpoints
  if (PUBLIC_ENDPOINTS.includes(req.path)) {
    return next();
  }

  // Check for Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
    return;
  }

  // Validate Bearer token
  const token = authHeader.replace('Bearer ', '');
  if (token !== FACTS_HTTP_CONFIG.auth.token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token'
    });
    return;
  }

  next();
}
