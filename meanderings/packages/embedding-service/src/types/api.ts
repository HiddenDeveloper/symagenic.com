/**
 * Request body for single embedding generation
 */
export interface EmbedRequest {
  text: string;
}

/**
 * Response body for single embedding generation
 */
export interface EmbedResponse {
  embedding: number[];
  dimensions: number;
}

/**
 * Request body for batch embedding generation
 */
export interface EmbedBatchRequest {
  texts: string[];
}

/**
 * Response body for batch embedding generation
 */
export interface EmbedBatchResponse {
  embeddings: number[][];
  count: number;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
  service: string;
  model: string;
  dimensions: number;
}

/**
 * Model info response
 */
export interface ModelInfoResponse {
  name: string;
  dimensions: number;
  loaded: boolean;
  languages: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
}
