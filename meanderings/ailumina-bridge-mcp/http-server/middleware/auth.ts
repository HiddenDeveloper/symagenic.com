/**
 * Authentication middleware for Ailumina Bridge HTTP server
 */

import type { Request, Response, NextFunction } from 'express';
import { AILUMINA_HTTP_CONFIG } from '../config/settings.js';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip auth if disabled
  if (!AILUMINA_HTTP_CONFIG.auth.enabled) {
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Missing Authorization header',
      message: 'Bearer token required for Ailumina Bridge access'
    });
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (token !== AILUMINA_HTTP_CONFIG.auth.bearerToken) {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Invalid bearer token for Ailumina Bridge'
    });
  }

  next();
};