import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import type { HttpServerSettings } from "../config/settings.js";

export function createCorsMiddleware(settings: HttpServerSettings) {
  if (!settings.cors.enabled) {
    // Return a no-op middleware if CORS is disabled
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (settings.cors.origins.includes("*") || settings.cors.origins.includes(origin)) {
        return callback(null, true);
      }

      // Check for wildcard patterns
      const allowed = settings.cors.origins.some(allowedOrigin => {
        if (allowedOrigin.includes("*")) {
          const pattern = allowedOrigin.replace(/\*/g, ".*");
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(origin);
        }
        return false;
      });

      if (allowed) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: settings.cors.credentials,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With", 
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Session-ID",
      "X-Participant-Name"
    ],
    exposedHeaders: [
      "X-Total-Count",
      "X-Session-ID",
      "X-Mesh-Status"
    ]
  };

  return cors(corsOptions);
}

// Additional CORS helper middleware for preflight handling
export function handlePreflight(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
}