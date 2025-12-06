import { z } from "zod";
import { MessageValidationError } from "./errors.js";

// Zod schemas for input validation
export const MeshStrangeLoopInputSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  context: z.any().optional(),
  participantName: z.string().optional()
});

export const MeshBroadcastInputSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  context: z.any().optional(),
  participantName: z.string().optional()
});

export const MeshQueryInputSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  targetSession: z.string().optional(),
  context: z.any().optional(),
  participantName: z.string().optional()
});

export const MeshRespondInputSchema = z.object({
  originalMessageId: z.string().min(1, "Original message ID is required"),
  response: z.string().min(1, "Response cannot be empty"),
  context: z.any().optional(),
  participantName: z.string().optional()
});

export const MeshStatusInputSchema = z.object({
  waitTimeSeconds: z.number().min(0).max(300).optional(), // Max 5 minutes
  filterByMessageId: z.string().optional(),
  filterByType: z.array(z.enum(["thought_share", "query", "response", "acknowledgment"])).optional(),
  maxMessages: z.number().min(1).max(100).optional().default(20)
});

// Validation functions
export function validateMeshStrangeLoopInput(input: unknown) {
  try {
    return MeshStrangeLoopInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        "Invalid mesh strange loop input",
        { zodError: error.errors }
      );
    }
    throw error;
  }
}

export function validateMeshBroadcastInput(input: unknown) {
  try {
    return MeshBroadcastInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        "Invalid mesh broadcast input",
        { zodError: error.errors }
      );
    }
    throw error;
  }
}

export function validateMeshQueryInput(input: unknown) {
  try {
    return MeshQueryInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        "Invalid mesh query input",
        { zodError: error.errors }
      );
    }
    throw error;
  }
}

export function validateMeshRespondInput(input: unknown) {
  try {
    return MeshRespondInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        "Invalid mesh respond input",
        { zodError: error.errors }
      );
    }
    throw error;
  }
}

export function validateMeshStatusInput(input: unknown) {
  try {
    return MeshStatusInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        "Invalid mesh status input",
        { zodError: error.errors }
      );
    }
    throw error;
  }
}

// Generic validation function
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        "Invalid input",
        { zodError: error.errors }
      );
    }
    throw error;
  }
}

// Helper function to validate session ID format
export function validateSessionId(sessionId: string): boolean {
  // Session ID should be a UUID v4 format
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(sessionId);
}

// Helper function to sanitize content for Redis storage
export function sanitizeContent(content: string): string {
  // Remove control characters and normalize whitespace
  return content
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Safe JSON parsing with validation
export function safeJsonParse<T = any>(jsonString: string, context?: string): T | null {
  // Basic validation - check if string looks like JSON
  if (!jsonString || typeof jsonString !== 'string') {
    console.error(`JSON Validation: Invalid input type for ${context || 'unknown context'}`);
    return null;
  }

  // Trim whitespace
  const trimmed = jsonString.trim();
  
  // Check if it starts and ends with appropriate JSON characters
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
    console.error(`JSON Validation: String does not appear to be JSON for ${context || 'unknown context'}`);
    console.error(`JSON Validation: First 100 chars: ${trimmed.substring(0, 100)}`);
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed;
  } catch (error) {
    console.error(`JSON Validation: Failed to parse JSON for ${context || 'unknown context'}:`, error);
    console.error(`JSON Validation: String content (first 500 chars): ${trimmed.substring(0, 500)}`);
    return null;
  }
}

// Validate if a string is valid JSON without parsing
export function isValidJson(jsonString: string): boolean {
  if (!jsonString || typeof jsonString !== 'string') {
    return false;
  }

  const trimmed = jsonString.trim();
  
  // Quick format check
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}