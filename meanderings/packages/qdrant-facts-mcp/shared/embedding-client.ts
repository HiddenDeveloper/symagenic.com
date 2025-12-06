/**
 * Embedding Client
 *
 * HTTP client for the centralized embedding service.
 * Provides the same interface as the local embedding-utils but delegates
 * to the embedding-service via HTTP, eliminating model duplication.
 */

export interface EmbedResponse {
  embedding: number[];
  dimensions: number;
}

export interface EmbedBatchResponse {
  embeddings: number[][];
  count: number;
}

export interface EmbeddingClientConfig {
  /**
   * Base URL of the embedding service
   * Default: http://embedding-service:3007 (Docker) or http://localhost:3007 (local)
   */
  baseUrl?: string;

  /**
   * Authentication token for the embedding service
   */
  authToken?: string;

  /**
   * Request timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Embedding service client
 */
export class EmbeddingClient {
  private baseUrl: string;
  private authToken?: string;
  private timeout: number;

  constructor(config: EmbeddingClientConfig = {}) {
    // Auto-detect environment (Docker vs local)
    const isDocker = process.env.EMBEDDING_SERVICE_URL ||
                     process.env.DOCKER_CONTAINER === 'true';

    this.baseUrl = config.baseUrl ||
                   process.env.EMBEDDING_SERVICE_URL ||
                   (isDocker ? 'http://embedding-service:3007' : 'http://localhost:3007');

    this.authToken = config.authToken || process.env.EMBEDDING_SERVICE_AUTH_TOKEN;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(`Embedding service error (${response.status}): ${error.error || response.statusText}`);
      }

      const data = await response.json() as EmbedResponse;

      console.log(`[EmbeddingClient] ✅ Generated ${data.dimensions}-dimensional embedding for text: "${text.substring(0, 50)}..."`);

      return data.embedding;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Embedding request timed out after ${this.timeout}ms`);
        }
        throw new Error(`Failed to generate embedding: ${error.message}`);
      }
      throw new Error('Failed to generate embedding: Unknown error');
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }

    if (texts.length > 100) {
      throw new Error('Batch size limit: 100 texts per request');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2); // Double timeout for batch

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.baseUrl}/embed/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ texts }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(`Embedding service error (${response.status}): ${error.error || response.statusText}`);
      }

      const data = await response.json() as EmbedBatchResponse;

      console.log(`[EmbeddingClient] ✅ Generated ${data.count} embeddings in batch`);

      return data.embeddings;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Batch embedding request timed out after ${this.timeout * 2}ms`);
        }
        throw new Error(`Failed to generate batch embeddings: ${error.message}`);
      }
      throw new Error('Failed to generate batch embeddings: Unknown error');
    }
  }

  /**
   * Check if embedding service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Global singleton instance for convenience
 */
let defaultClient: EmbeddingClient | null = null;

/**
 * Get or create the default embedding client
 */
export function getEmbeddingClient(config?: EmbeddingClientConfig): EmbeddingClient {
  if (!defaultClient) {
    defaultClient = new EmbeddingClient(config);
  }
  return defaultClient;
}

/**
 * Generate embedding for a single text (convenience function)
 * Uses the default singleton client
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getEmbeddingClient();
  return client.generateEmbedding(text);
}

/**
 * Generate embeddings for multiple texts (convenience function)
 * Uses the default singleton client
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  const client = getEmbeddingClient();
  return client.generateEmbeddingBatch(texts);
}

/**
 * Calculate cosine similarity between two embeddings
 * Useful for consciousness research analysis
 *
 * NOTE: This is kept from the original embedding-utils.ts for compatibility
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same dimensionality");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
