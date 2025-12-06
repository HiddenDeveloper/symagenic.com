import { Request, Response, NextFunction } from 'express';
import { config } from '../config/settings.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!config.authEnabled) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header provided' });
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid authorization format' });
  }

  if (token !== config.bearerToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  next();
}
