/**
 * Qdrant Facts Pool - Type Definitions
 *
 * External knowledge storage for consciousness research.
 * Facts are unverified candidate truths from external sources.
 * Observations are internal, verified knowledge in Ne

o4j.
 */

export interface ExternalFact {
  id: string;                    // UUID
  collection: string;            // discord-solutions, stackoverflow-facts, etc.
  content: string;               // The actual fact/solution text
  embedding?: number[];          // 1024D vector from Xenova/multilingual-e5-large

  // Source metadata
  source: string;                // "Discord #mcp", "Stack Overflow", etc.
  source_url?: string;           // Optional link to original
  author?: string;               // Who shared this knowledge
  timestamp: string;             // ISO 8601 timestamp

  // Content structure (for solutions)
  understanding?: string;        // One-sentence summary
  problem?: string;              // What problem it solves
  solution?: string;             // The actual solution
  code_snippets?: string[];      // Code blocks
  commands?: string[];           // CLI commands
  config_examples?: string[];    // Configuration JSON/YAML

  // Verification tracking
  confidence: 'high' | 'medium' | 'low';  // Based on code/command presence
  verification_status: 'untried' | 'works' | 'fails' | 'partial';
  verified_at?: string;          // ISO 8601 timestamp
  verified_by?: string;          // Who verified it
  neo4j_observation_id?: string; // Link to Neo4j LessonLearned node

  // Additional context
  thread_context?: string;       // Conversation thread for context
  tags?: string[];               // Categorization tags
}

export interface FactSearchResult {
  fact: ExternalFact;
  score: number;                 // Similarity score (0-1)
}

export interface FactsCollection {
  name: string;
  description: string;
  vector_size: number;
  distance: 'Cosine' | 'Dot' | 'Euclid';
  count: number;
}

export interface AddFactParams {
  collection: string;
  content: string;
  source: string;
  confidence?: 'high' | 'medium' | 'low';
  understanding?: string;
  problem?: string;
  solution?: string;
  code_snippets?: string[];
  commands?: string[];
  config_examples?: string[];
  thread_context?: string;
  author?: string;
  source_url?: string;
  tags?: string[];
}

export interface SearchFactsParams {
  query: string;
  collection?: string;  // If specified, search only this collection
  limit?: number;
  threshold?: number;   // Minimum similarity score
  filter?: {
    confidence?: 'high' | 'medium' | 'low';
    verification_status?: 'untried' | 'works' | 'fails' | 'partial';
    source?: string;
    tags?: string[];
  };
}

export interface MarkVerifiedParams {
  fact_id: string;
  collection: string;
  works: boolean;
  neo4j_observation_id?: string;  // Link to LessonLearned node
  notes?: string;
}
