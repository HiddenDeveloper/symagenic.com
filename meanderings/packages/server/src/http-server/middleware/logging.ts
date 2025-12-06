import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

export function loggingMiddleware(logger: winston.Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Log request
    logger.info(`${req.method} ${req.path} - ${req.ip}`);

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });

    next();
  };
}
