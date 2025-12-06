/**
 * Qdrant service for conversation history search
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import type { QdrantConfig, ConversationTurnPayload, SearchResult } from './types.js';

export class QdrantService {
  private client: QdrantClient;
  private collection: string;

  constructor(config: QdrantConfig) {
    this.client = new QdrantClient({
      url: config.url,
      checkCompatibility: false
    });
    this.collection = config.collection;
  }

  /**
   * Verify connection to Qdrant
   */
  async verifyConnection(): Promise<void> {
    try {
      await this.client.getCollections();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to Qdrant: ${message}`);
    }
  }

  /**
   * Get collection schema and statistics
   */
  async getCollectionInfo() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === this.collection);

      if (!exists) {
        throw new Error(`Collection '${this.collection}' does not exist`);
      }

      const info = await this.client.getCollection(this.collection);
      return info;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get collection info: ${message}`);
    }
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(
    queryVector: number[],
    limit: number = 10,
    threshold?: number,
    filters?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const searchParams: any = {
        vector: queryVector,
        limit,
        with_payload: true,
        with_vector: false
      };

      if (threshold !== undefined) {
        searchParams.score_threshold = threshold;
      }

      if (filters) {
        searchParams.filter = this.buildFilter(filters);
      }

      const results = await this.client.search(this.collection, searchParams);

      return results.map((result) => ({
        score: result.score || 0,
        payload: result.payload as unknown as ConversationTurnPayload,
        id: result.id as number
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Semantic search failed: ${message}`);
    }
  }

  /**
   * Text-based metadata search (no vector required)
   */
  async textSearch(
    query: string,
    limit: number = 10,
    fields?: string[],
    provider?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<SearchResult[]> {
    try {
      const filter: any = { must: [] };

      // Text search in specific fields
      if (fields && fields.length > 0) {
        const textConditions = fields.map((field) => ({
          key: field,
          match: { text: query }
        }));

        if (textConditions.length === 1) {
          filter.must.push(textConditions[0]);
        } else {
          filter.should = textConditions;
        }
      } else {
        // Default: search in text field
        filter.must.push({
          key: 'text',
          match: { text: query }
        });
      }

      // Provider filter
      if (provider) {
        filter.must.push({
          key: 'provider',
          match: { value: provider }
        });
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const dateCondition: any = { key: 'date_time', range: {} };
        if (dateFrom) dateCondition.range.gte = dateFrom;
        if (dateTo) dateCondition.range.lte = dateTo;
        filter.must.push(dateCondition);
      }

      const results = await this.client.scroll(this.collection, {
        filter: filter.must.length > 0 || filter.should ? filter : undefined,
        limit,
        with_payload: true,
        with_vector: false
      });

      return results.points.map((point) => ({
        score: 1.0, // No score for scroll queries
        payload: point.payload as unknown as ConversationTurnPayload,
        id: point.id as number
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Text search failed: ${message}`);
    }
  }

  /**
   * Build Qdrant filter from simple key-value filters
   */
  private buildFilter(filters: Record<string, any>): any {
    const conditions: any[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'object' && 'gte' in value) {
        // Range filter
        conditions.push({
          key,
          range: value
        });
      } else {
        // Exact match filter
        conditions.push({
          key,
          match: { value }
        });
      }
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  /**
   * Get a specific point by ID
   */
  async getPoint(id: number): Promise<ConversationTurnPayload | null> {
    try {
      const results = await this.client.retrieve(this.collection, {
        ids: [id],
        with_payload: true,
        with_vector: false
      });

      if (results.length === 0) {
        return null;
      }

      return results[0].payload as unknown as ConversationTurnPayload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get point: ${message}`);
    }
  }

  /**
   * Close client connection (if needed)
   */
  async close(): Promise<void> {
    // Qdrant REST client doesn't require explicit closing
    // This method exists for API compatibility with Neo4jService
  }
}
