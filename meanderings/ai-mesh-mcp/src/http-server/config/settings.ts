import { config } from "dotenv";
import { threadId } from "node:worker_threads";

// Load environment variables
config();

export interface HttpServerSettings {
  port: number;
  host: string;
  cors: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
  };
  redis: {
    url: string;
    messageRetention: number;
    enableQueue: boolean;
  };
  mesh: {
    sessionId: string;
    participantName?: string;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    requests: boolean;
  };
  auth: {
    enabled: boolean;
    bearerToken?: string;
  };
}

// Generate a unique session ID if not provided
function generateSessionId(): string {
  const timestamp = Date.now();
  const microTime = process.hrtime.bigint();
  const randomPart1 = Math.random().toString(36).substr(2, 9);
  const randomPart2 = Math.random().toString(36).substr(2, 9);
  const processId = process.pid;
  const currentThreadId = threadId || 0;
  const extraEntropy = Buffer.from(Math.random().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substr(0, 8);
  return `ai-mesh-${timestamp}-${microTime}-${processId}-${currentThreadId}-${randomPart1}-${randomPart2}-${extraEntropy}`;
}

// Function to get session ID - generates new one each time if not set via env
export function getSessionId(): string {
  return process.env['SESSION_ID'] || generateSessionId();
}

// Generate a session ID for this server instance
const CURRENT_SESSION_ID = getSessionId();

// Environment variables with backward compatibility
const HTTP_PORT = process.env['PORT'] || process.env['MESH_HTTP_PORT'] || process.env['HTTP_PORT'] || "3002";
const HTTP_HOST = process.env['HOST'] || process.env['MESH_HTTP_HOST'] || process.env['HTTP_HOST'] || "localhost";

// Log deprecation warnings
if (process.env['HTTP_PORT'] && !process.env['MESH_HTTP_PORT']) {
  console.warn('⚠️  HTTP_PORT is deprecated, use MESH_HTTP_PORT instead');
}
if (process.env['HTTP_HOST'] && !process.env['MESH_HTTP_HOST']) {
  console.warn('⚠️  HTTP_HOST is deprecated, use MESH_HTTP_HOST instead');
}

export const httpServerSettings: HttpServerSettings = {
  port: parseInt(HTTP_PORT, 10),
  host: HTTP_HOST,

  cors: {
    enabled: process.env['CORS_ENABLED'] !== "false",
    origins: process.env['CORS_ORIGINS']?.split(",") || ["*"],
    credentials: process.env['CORS_CREDENTIALS'] === "true"
  },

  redis: {
    url: process.env['REDIS_URL'] || "redis://localhost:6379",
    messageRetention: parseInt(process.env['MESSAGE_RETENTION'] || "3600", 10),
    enableQueue: process.env['ENABLE_QUEUE'] !== "false"
  },

  mesh: {
    sessionId: CURRENT_SESSION_ID,
    ...(process.env['PARTICIPANT_NAME'] && { participantName: process.env['PARTICIPANT_NAME'] })
  },

  logging: {
    level: (process.env['LOG_LEVEL'] as any) || "info",
    requests: process.env['LOG_REQUESTS'] !== "false"
  },

  auth: {
    enabled: process.env['AUTH_ENABLED'] === "true",
    ...(process.env['BEARER_TOKEN'] && { bearerToken: process.env['BEARER_TOKEN'] })
  }
};

// Validate settings
export function validateSettings(settings: HttpServerSettings): void {
  if (settings.port < 1 || settings.port > 65535) {
    throw new Error(`Invalid port: ${settings.port}. Must be between 1 and 65535`);
  }

  if (settings.redis.messageRetention < 60) {
    throw new Error(`Message retention too low: ${settings.redis.messageRetention}s. Minimum is 60 seconds`);
  }

  if (settings.auth.enabled && !settings.auth.bearerToken) {
    throw new Error("Auth enabled but no bearer token provided");
  }

  console.log("HTTP Server Settings validated successfully");
}

// Log current settings (excluding sensitive data)
export function logSettings(settings: HttpServerSettings): void {
  const safeSettings = {
    ...settings,
    auth: {
      ...settings.auth,
      bearerToken: settings.auth.bearerToken ? "[REDACTED]" : undefined
    }
  };

  console.log("AI Mesh HTTP Server Configuration:");
  console.log(JSON.stringify(safeSettings, null, 2));
}