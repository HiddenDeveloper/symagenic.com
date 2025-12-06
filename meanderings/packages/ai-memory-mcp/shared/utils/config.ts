/**
 * Configuration utilities for Memory system
 */

import type { Neo4jConfig } from '../types.js';

export type TenancyMode = 'shared' | 'scoped' | 'federated';

/**
 * Environment-based configuration with sensible defaults
 */
export const getMemoryConfig = (): Neo4jConfig => ({
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  user: process.env.NEO4J_USER || "neo4j", 
  password: process.env.NEO4J_PASSWORD || "testpassword123",
  database: process.env.NEO4J_DATABASE || "neo4j",
});

/**
 * Get HTTP server port for memory system
 */
export const getMemoryHttpPort = (): number => {
  return parseInt(process.env.MEMORY_HTTP_PORT || "3003", 10);
};

/**
 * Get HTTP server URL for STDIO wrapper
 */
export const getMemoryHttpUrl = (): string => {
  return process.env.MEMORY_HTTP_URL || `http://localhost:${getMemoryHttpPort()}`;
};

/**
 * Tenancy mode for memory addressing
 * - shared: no owner scoping; collective memory allowed
 * - scoped: default read/write scoped to owner_did
 * - federated: scoped by default, but allows explicit shared/import flows
 */
export const getTenancyMode = (): TenancyMode => {
  const mode = (process.env.MEMORY_TENANCY_MODE || 'shared').toLowerCase();
  if (mode === 'scoped' || mode === 'federated') return mode;
  return 'shared';
};

/**
 * Owner DID for scoped/federated tenancy
 */
export const getOwnerDid = (): string | undefined => {
  const did = process.env.MEMORY_OWNER_DID;
  return did && did.trim() ? did.trim() : undefined;
};
