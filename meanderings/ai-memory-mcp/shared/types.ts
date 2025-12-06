/**
 * Shared types for Memory MCP dual-transport server
 */

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  database?: string;
}

export interface MemoryToolRequest {
  toolName: string;
  parameters: Record<string, any>;
}

export interface MemoryToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

export interface SemanticSearchParams {
  query: string;
  limit?: number;
  threshold?: number;
  node_types?: string[];
}

export interface CypherQueryParams {
  query: string;
  mode: "READ" | "WRITE";  // Required: explicit intent for read vs write operations
  parameters?: Record<string, any>;
  /**
   * Optional client-observed schema epoch from the last get_schema call,
   * used to detect concurrent schema changes before WRITE.
   */
  client_schema_epoch?: number;
}

export interface SchemaParams {
  include_statistics?: boolean;
}

export interface TextSearchParams {
  query: string;
  node_types?: string[];
  properties?: string[];
  fuzzy?: boolean;
  limit?: number;
}

export interface MemoryRecord {
  [key: string]: any;
  score?: number;
}
