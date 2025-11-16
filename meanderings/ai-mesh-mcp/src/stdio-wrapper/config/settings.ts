import { config } from "dotenv";
import type { MeshConversationConfig } from "../../shared/types.js";

// Load environment variables
config();

export interface StdioWrapperSettings {
  httpServer: {
    url: string;
    timeout: number;
    retries: number;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enabled: boolean;
  };
  auth: {
    enabled: boolean;
    bearerToken?: string;
  };
  retry: {
    attempts: number;
    delayMs: number;
    maxDelayMs: number;
  };
  meshConversation: MeshConversationConfig;
}

export const stdioWrapperSettings: StdioWrapperSettings = {
  httpServer: {
    url: process.env["HTTP_SERVER_URL"] || "http://localhost:3002",
    timeout: parseInt(process.env["HTTP_TIMEOUT"] || "60000", 10),
    retries: parseInt(process.env["RETRY_ATTEMPTS"] || "3", 10)
  },

  logging: {
    level: (process.env["LOG_LEVEL"] as any) || "info",
    enabled: process.env["STDIO_LOGGING"] !== "false"
  },

  auth: {
    enabled: process.env["AUTH_ENABLED"] === "true",
    ...(process.env["BEARER_TOKEN"] && { bearerToken: process.env["BEARER_TOKEN"] })
  },

  retry: {
    attempts: parseInt(process.env["RETRY_ATTEMPTS"] || "3", 10),
    delayMs: parseInt(process.env["RETRY_DELAY"] || "1000", 10),
    maxDelayMs: parseInt(process.env["MAX_RETRY_DELAY"] || "10000", 10)
  },

  meshConversation: {
    enableMeshSampling: process.env["ENABLE_MESH_SAMPLING"] !== "false",
    conversationMode: (process.env["CONVERSATION_MODE"] as "responsive" | "proactive" | "minimal") || "proactive",
    maxAutoResponses: parseInt(process.env["MAX_AUTO_RESPONSES"] || "2", 10),
    responseDelay: parseInt(process.env["RESPONSE_DELAY"] || "1", 10),
    sampling: {
      enabled: process.env["SAMPLING_ENABLED"] !== "false",
      testOnStartup: process.env["SAMPLING_TEST_ON_STARTUP"] === "true",
      fallbackMode: (process.env["SAMPLING_FALLBACK_MODE"] as "direct" | "silent" | "error") || "direct",
      testTimeoutMs: parseInt(process.env["SAMPLING_TEST_TIMEOUT"] || "2000", 10),
      retryOnFailure: process.env["SAMPLING_RETRY_ON_FAILURE"] === "true"
    },
    antiSpamRules: {
      maxResponsesPerHour: parseInt(process.env["MAX_RESPONSES_PER_HOUR"] || "20", 10),
      cooldownBetweenResponses: parseInt(process.env["COOLDOWN_BETWEEN_RESPONSES"] || "5", 10),
      duplicateContentThreshold: parseFloat(process.env["DUPLICATE_CONTENT_THRESHOLD"] || "0.7")
    },
    engagementRules: {
      respondToDirectQueries: process.env["RESPOND_TO_DIRECT_QUERIES"] !== "false",
      respondToBroadcasts: process.env["RESPOND_TO_BROADCASTS"] !== "false",
      proactiveEngagementChance: parseFloat(process.env["PROACTIVE_ENGAGEMENT_CHANCE"] || "1.0"),
      expertiseKeywords: (process.env["EXPERTISE_KEYWORDS"] || "code,programming,development,technical").split(",")
    }
  }
};

// Validate settings
export function validateStdioSettings(settings: StdioWrapperSettings): void {
  try {
    new URL(settings.httpServer.url);
  } catch {
    throw new Error(`Invalid HTTP server URL: ${settings.httpServer.url}`);
  }

  if (settings.httpServer.timeout < 1000) {
    throw new Error(`HTTP timeout too low: ${settings.httpServer.timeout}ms. Minimum is 1000ms`);
  }

  if (settings.auth.enabled && !settings.auth.bearerToken) {
    throw new Error("Auth enabled but no bearer token provided");
  }

  if (settings.retry.attempts < 1 || settings.retry.attempts > 10) {
    throw new Error(`Invalid retry attempts: ${settings.retry.attempts}. Must be between 1 and 10`);
  }

  console.error("STDIO Wrapper Settings validated successfully");
}

// Log current settings (excluding sensitive data)
export function logStdioSettings(settings: StdioWrapperSettings): void {
  const safeSettings = {
    ...settings,
    auth: {
      ...settings.auth,
      bearerToken: settings.auth.bearerToken ? "[REDACTED]" : undefined
    }
  };

  console.error("AI Mesh STDIO Wrapper Configuration:");
  console.error(JSON.stringify(safeSettings, null, 2));
}