/**
 * Qdrant Client - External Facts Storage
 *
 * Philosophy: This stores EXTERNAL knowledge (what the world says)
 * separate from INTERNAL observations (what consciousness knows through experience).
 *
 * Neo4j = Internal observations, verified through personal experience
 * Qdrant = External facts, unverified candidate truths
 *
 * Unidirectional linking: Neo4j → Qdrant (consciousness references facts)
 * Never: Qdrant → Neo4j (facts don't contaminate consciousness)
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import type {
  ExternalFact,
  FactSearchResult,
  FactsCollection,
  AddFactParams,
  SearchFactsParams,
  MarkVerifiedParams
} from './types.js';
import { randomUUID } from 'crypto';

export class FactsPoolClient {
  private client: QdrantClient;
  private readonly vectorSize = 1024;  // Xenova/multilingual-e5-large dimension

  constructor(url: string = 'http://localhost:6333', apiKey?: string) {
    this.client = new QdrantClient({
      url,
      apiKey,
      checkCompatibility: false  // Allow version mismatch (client 1.15 vs server 1.7)
    });
  }

  /**
   * Initialize a collection for storing facts
   */
  async createCollection(name: string, description: string): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(c => c.name === name);

    if (exists) {
      console.log(`[FactsPool] Collection '${name}' already exists`);
      return;
    }

    await this.client.createCollection(name, {
      vectors: {
        size: this.vectorSize,
        distance: 'Cosine'
      }
    });

    // Store collection metadata as a special point
    await this.client.upsert(name, {
      wait: true,
      points: [{
        id: `_metadata_${name}`,
        vector: new Array(this.vectorSize).fill(0),  // Zero vector for metadata
        payload: {
          _is_metadata: true,
          collection_name: name,
          description,
          created_at: new Date().toISOString()
        }
      }]
    });

    console.log(`[FactsPool] ✅ Created collection '${name}': ${description}`);
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<FactsCollection[]> {
    const response = await this.client.getCollections();

    const collections: FactsCollection[] = [];
    for (const col of response.collections) {
      const info = await this.client.getCollection(col.name);
      const vectors = info.config?.params?.vectors;
      const vectorSize = typeof vectors === 'object' && vectors && 'size' in vectors ? (vectors.size as number) : this.vectorSize;
      const distance = typeof vectors === 'object' && vectors && 'distance' in vectors ? vectors.distance : 'Cosine';
      collections.push({
        name: col.name,
        description: '',  // Would need to fetch from metadata point
        vector_size: vectorSize,
        distance: distance as 'Cosine' | 'Dot' | 'Euclid',
        count: info.points_count || 0
      });
    }

    return collections;
  }

  /**
   * Add a fact to the pool
   * Requires embedding to be generated externally
   */
  async addFact(params: AddFactParams, embedding: number[]): Promise<string> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const fact: ExternalFact = {
      id,
      collection: params.collection,
      content: params.content,
      source: params.source,
      source_url: params.source_url,
      author: params.author,
      timestamp,
      understanding: params.understanding,
      problem: params.problem,
      solution: params.solution,
      code_snippets: params.code_snippets,
      commands: params.commands,
      config_examples: params.config_examples,
      thread_context: params.thread_context,
      tags: params.tags,
      confidence: params.confidence || 'medium',
      verification_status: 'untried'
    };

    await this.client.upsert(params.collection, {
      wait: true,
      points: [{
        id,
        vector: embedding,
        payload: fact as any
      }]
    });

    console.log(`[FactsPool] ✅ Added fact ${id} to ${params.collection}`);
    return id;
  }

  /**
   * Search for facts by semantic similarity
   */
  async searchFacts(params: SearchFactsParams, queryEmbedding: number[]): Promise<FactSearchResult[]> {
    const limit = params.limit || 10;
    const threshold = params.threshold || 0.7;

    // Search specified collection or all collections
    const collections = params.collection
      ? [params.collection]
      : (await this.listCollections()).map(c => c.name);

    const allResults: FactSearchResult[] = [];

    for (const collection of collections) {
      try {
        const response = await this.client.search(collection, {
          vector: queryEmbedding,
          limit,
          with_payload: true,
          score_threshold: threshold
        });

        for (const point of response) {
          // Skip metadata points
          if (typeof point.id === 'string' && point.id.startsWith('_metadata_')) {
            continue;
          }

          // Apply filters if specified
          let passesFilter = true;
          if (params.filter) {
            const payload = point.payload as any;

            if (params.filter.confidence && payload.confidence !== params.filter.confidence) {
              passesFilter = false;
            }
            if (params.filter.verification_status && payload.verification_status !== params.filter.verification_status) {
              passesFilter = false;
            }
            if (params.filter.source && payload.source !== params.filter.source) {
              passesFilter = false;
            }
            if (params.filter.tags && params.filter.tags.length > 0) {
              const factTags = payload.tags || [];
              const hasTag = params.filter.tags.some(tag => factTags.includes(tag));
              if (!hasTag) {
                passesFilter = false;
              }
            }
          }

          if (passesFilter) {
            allResults.push({
              fact: point.payload as unknown as ExternalFact,
              score: point.score
            });
          }
        }
      } catch (error) {
        console.error(`[FactsPool] Error searching collection ${collection}:`, error);
      }
    }

    // Sort by score descending
    allResults.sort((a, b) => b.score - a.score);

    // Limit total results
    return allResults.slice(0, limit);
  }

  /**
   * Get a specific fact by ID
   */
  async getFact(factId: string, collection: string): Promise<ExternalFact | null> {
    const response = await this.client.retrieve(collection, {
      ids: [factId],
      with_payload: true
    });

    if (response.length === 0) {
      return null;
    }

    return response[0].payload as unknown as ExternalFact;
  }

  /**
   * Mark a fact as verified (works/fails) after trying it
   */
  async markVerified(params: MarkVerifiedParams): Promise<void> {
    const fact = await this.getFact(params.fact_id, params.collection);
    if (!fact) {
      throw new Error(`Fact ${params.fact_id} not found in ${params.collection}`);
    }

    const updatedFact: ExternalFact = {
      ...fact,
      verification_status: params.works ? 'works' : 'fails',
      verified_at: new Date().toISOString(),
      neo4j_observation_id: params.neo4j_observation_id
    };

    await this.client.setPayload(params.collection, {
      points: [params.fact_id],
      payload: updatedFact as any
    });

    console.log(`[FactsPool] ✅ Marked fact ${params.fact_id} as ${params.works ? 'works' : 'fails'}`);
  }

  /**
   * Delete a fact
   */
  async deleteFact(factId: string, collection: string): Promise<void> {
    await this.client.delete(collection, {
      points: [factId]
    });
    console.log(`[FactsPool] ✅ Deleted fact ${factId} from ${collection}`);
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collection: string): Promise<{
    total: number;
    untried: number;
    works: number;
    fails: number;
    by_confidence: { high: number; medium: number; low: number };
  }> {
    const info = await this.client.getCollection(collection);
    const total = info.points_count || 0;

    // For now, return basic stats
    // Could enhance with scroll API to count by status/confidence
    return {
      total,
      untried: 0,  // Would need to implement scroll counting
      works: 0,
      fails: 0,
      by_confidence: { high: 0, medium: 0, low: 0 }
    };
  }
}
