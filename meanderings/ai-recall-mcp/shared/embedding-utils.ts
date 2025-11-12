/**
 * Embedding utilities for AI Recall MCP
 *
 * Now delegates to the centralized embedding service via HTTP.
 * This eliminates model duplication and reduces memory footprint.
 *
 * For multilingual consciousness anthropology research.
 * The model produces 1024-dimensional vectors optimized for semantic similarity across 100+ languages.
 * Enables cross-cultural consciousness pattern discovery with state-of-the-art E5 architecture.
 */

import { generateEmbedding as generateEmbeddingClient, cosineSimilarity as cosineSimilarityClient } from '@ailumina/shared/utils';

/**
 * Generates an embedding for the given text using the centralized embedding service
 *
 * @param text The text to generate an embedding for
 * @returns A promise that resolves to an array of numbers representing the embedding (1024D)
 * @throws An error if the embedding generation fails
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return generateEmbeddingClient(text);
}

/**
 * Calculate cosine similarity between two embeddings
 * Useful for consciousness research analysis
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  return cosineSimilarityClient(a, b);
}
