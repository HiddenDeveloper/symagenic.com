import type { Request, Response, NextFunction } from "express";
import type { HttpServerSettings } from "../config/settings.js";

// Create a simple logger that respects the configured log level
class Logger {
  constructor(private level: string) { }

  private shouldLog(level: string): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.level as keyof typeof levels] ?? 1;
    const messageLevel = levels[level as keyof typeof levels] ?? 1;
    return messageLevel >= currentLevel;
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog("debug")) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog("info")) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog("warn")) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog("error")) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export function createLogger(settings: HttpServerSettings): Logger {
  return new Logger(settings.logging.level);
}

export function createRequestLoggingMiddleware(settings: HttpServerSettings) {
  const logger = createLogger(settings);

  if (!settings.logging.requests) {
    // Return a no-op middleware if request logging is disabled
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log request start
    logger.info(`${timestamp} ${req.method} ${req.url} - Start`);

    // Capture original res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any) {
      const duration = Date.now() - start;
      const size = res.get("Content-Length") || "-";

      logger.info(
        `${timestamp} ${req.method} ${req.url} - ${res.statusCode} ${duration}ms ${size}b`
      );

      // Call original end method and return its result
      return originalEnd.call(res, chunk, encoding);
    };

    next();
  };
}

// Error logging middleware
export function createErrorLoggingMiddleware(settings: HttpServerSettings) {
  const logger = createLogger(settings);

  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();

    logger.error(
      `${timestamp} ${req.method} ${req.url} - Error: ${error.message}`,
      {
        stack: error.stack,
        headers: req.headers,
        body: req.body
      }
    );

    // Don't expose internal errors in production
    if (res.headersSent) {
      return next(error);
    }

    res.status(500).json({
      error: "Internal Server Error",
      message: settings.logging.level === "debug" ? error.message : "An unexpected error occurred",
      timestamp
    });
  };
}