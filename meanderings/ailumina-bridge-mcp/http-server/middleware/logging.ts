/**
 * Logging middleware for Ailumina Bridge HTTP server
 */

import type { Request, Response, NextFunction } from 'express';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log(`[${timestamp}] Ailumina HTTP: ${req.method} ${req.path}`);
  
  // Log response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] Ailumina HTTP: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
};