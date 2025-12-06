import type { Request, Response, NextFunction } from "express";
import type { HttpServerSettings } from "../config/settings.js";

// Extend Express Request to include auth info
declare global {
  namespace Express {
    interface Request {
      isAuthenticated?: boolean;
      authToken?: string;
    }
  }
}

export function createAuthMiddleware(settings: HttpServerSettings) {
  if (!settings.auth.enabled) {
    // Return a no-op middleware if auth is disabled
    return (req: Request, _res: Response, next: NextFunction) => {
      req.isAuthenticated = true; // Always authenticated when auth disabled
      next();
    };
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // If already authenticated by OAuth middleware, skip bearer token check
    if (req.isAuthenticated) {
      return next();
    }

    // Skip auth for health check endpoints and well-known endpoints
    if (req.path === "/health" || req.path === "/" || req.path === "/.well-known/oauth-protected-resource") {
      req.isAuthenticated = true;
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing Authorization header"
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid Authorization header format. Expected: Bearer <token>"
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing bearer token"
      });
    }

    if (token !== settings.auth.bearerToken) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid bearer token"
      });
    }

    // Auth successful
    req.isAuthenticated = true;
    req.authToken = token;
    next();
  };
}

// Helper middleware to ensure authentication
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required"
    });
    return;
  }
  next();
}

// Optional auth middleware - allows both authenticated and unauthenticated requests
export function optionalAuth(_req: Request, _res: Response, next: NextFunction) {
  // Just continue - authentication status is already set by createAuthMiddleware
  next();
}