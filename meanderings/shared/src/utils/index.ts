/**
 * Shared Utilities
 * 
 * Common utility functions for message handling, provider detection,
 * and other functionality shared between server and client.
 */

import type { Message, MessagePart, ContentBlock } from '../types/index.js';
import { SERVICE_PROVIDERS } from '../constants/index.js';

/**
 * Normalize message content to plain text
 * Handles string content, array content (text blocks), and parts array (Gemini format)
 */
export function normalizeMessageContent(message: Message): string {
  // Handle string content
  if (typeof message.content === 'string') {
    return message.content;
  }

  // Handle array content (Anthropic/OpenAI format)
  if (Array.isArray(message.content)) {
    return message.content
      .filter((block: ContentBlock) => block.type === 'text' && block.text)
      .map((block: ContentBlock) => block.text)
      .join(' ');
  }

  // Handle parts array (Gemini format)
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts
      .filter((part: MessagePart) => part.text)
      .map((part: MessagePart) => part.text)
      .join(' ');
  }

  return '';
}

/**
 * Check if message has meaningful text content
 */
export function messageHasText(message: Message): boolean {
  const text = normalizeMessageContent(message);
  return text.trim().length > 0;
}

/**
 * Detect AI provider by message structure
 */
export function detectAIProvider(message: Message): string {
  // Gemini format - has parts array
  if (message.parts && Array.isArray(message.parts)) {
    return 'gemini';
  }

  // Anthropic format - has array content with type blocks
  if (Array.isArray(message.content) && message.content.length > 0) {
    const firstBlock = message.content[0] as ContentBlock;
    if (firstBlock && typeof firstBlock === 'object' && 'type' in firstBlock) {
      return 'anthropic';
    }
  }

  // OpenAI format - string content or tool_calls
  if (typeof message.content === 'string' || message.tool_calls) {
    return 'openai';
  }

  return 'unknown';
}

/**
 * Check if message should be displayed in UI
 * Filters out system messages and tool-only messages for OpenAI
 */
export function shouldDisplayMessage(message: Message): boolean {
  const provider = detectAIProvider(message);
  
  // For OpenAI, filter out system and tool messages
  if (provider === 'openai') {
    if (message.role === 'system' || message.role === 'tool') {
      return false;
    }
  }

  // For all providers, require visible text or meaningful content
  return messageHasText(message) || hasToolContent(message);
}

/**
 * Check if message has tool-related content that should be visible
 */
export function hasToolContent(message: Message): boolean {
  // Has tool calls
  if (message.tool_calls && message.tool_calls.length > 0) {
    return true;
  }

  // Has tool use blocks (Anthropic)
  if (Array.isArray(message.content)) {
    return message.content.some((block: ContentBlock) => 
      block.type === 'tool_use' || block.type === 'tool_result'
    );
  }

  // Has function calls (Gemini)
  if (message.parts && Array.isArray(message.parts)) {
    return message.parts.some((part: MessagePart) => 
      part.functionCall || part.functionResponse
    );
  }

  return false;
}

/**
 * Extract tool call information from message
 */
export function extractToolCalls(message: Message): Array<{
  id: string;
  name: string;
  arguments: string;
}> {
  const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

  // OpenAI format
  if (message.tool_calls) {
    for (const call of message.tool_calls) {
      if (call.function && call.id) {
        toolCalls.push({
          id: call.id,
          name: call.function.name,
          arguments: call.function.arguments
        });
      }
    }
  }

  // Anthropic format
  if (Array.isArray(message.content)) {
    for (const block of message.content) {
      const contentBlock = block as ContentBlock;
      if (contentBlock.type === 'tool_use' && contentBlock.name && contentBlock.input) {
        toolCalls.push({
          id: contentBlock.tool_use_id || '',
          name: contentBlock.name,
          arguments: JSON.stringify(contentBlock.input)
        });
      }
    }
  }

  // Gemini format
  if (message.parts) {
    for (const part of message.parts) {
      if (part.functionCall) {
        toolCalls.push({
          id: '', // Gemini doesn't use IDs the same way
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {})
        });
      }
    }
  }

  return toolCalls;
}

/**
 * Create a normalized message object
 */
export function createNormalizedMessage(
  role: string,
  content: string | ContentBlock[],
  options: {
    parts?: MessagePart[];
    tool_calls?: any[];
    tool_call_id?: string;
    id?: string;
    timestamp?: string;
  } = {}
): Message {
  return {
    role: role as any,
    content,
    parts: options.parts,
    tool_calls: options.tool_calls,
    tool_call_id: options.tool_call_id,
    id: options.id || Date.now().toString(),
    timestamp: options.timestamp || new Date().toISOString(),
  };
}

/**
 * Validate message structure
 */
export function validateMessage(message: Message): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!message.role) {
    errors.push('Message must have a role');
  }

  if (!message.content && !message.parts && !message.tool_calls) {
    errors.push('Message must have content, parts, or tool_calls');
  }

  // Validate tool calls format
  if (message.tool_calls) {
    for (const call of message.tool_calls) {
      if (!call.function?.name) {
        errors.push('Tool call must have function.name');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Convert service provider string to standardized format
 */
export function normalizeServiceProvider(provider: string): string {
  const normalized = provider.toUpperCase();
  return Object.values(SERVICE_PROVIDERS).includes(normalized as any)
    ? normalized
    : 'UNKNOWN';
}

/**
 * Generate embedding by calling the centralized embedding service
 * @param text The text to generate an embedding for
 * @returns Promise resolving to 1024-dimensional embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:3007';
  const authToken = process.env.EMBEDDING_SERVICE_AUTH_TOKEN || '';

  try {
    const response = await fetch(`${embeddingServiceUrl}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Embedding service returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('[Embedding Client] Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param a First embedding vector
 * @param b Second embedding vector
 * @returns Cosine similarity score between -1 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}