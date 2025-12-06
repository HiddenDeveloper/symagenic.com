/**
 * Logging middleware for Qdrant Facts HTTP server
 */

import { Request, Response, NextFunction } from 'express';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    const reset = '\x1b[0m';

    console.log(
      `${statusColor}${res.statusCode}${reset} ${req.method} ${req.path} - ${duration}ms`
    );
  });

  next();
}
