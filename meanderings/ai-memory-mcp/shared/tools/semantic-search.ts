/**
 * Semantic Search tool for Memory system
 */

import { Neo4jService } from '../neo4j-service.js';
import type { Neo4jConfig, SemanticSearchParams, MemoryToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';

export class SemanticSearchTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: SemanticSearchParams): Promise<MemoryToolResponse> {
    const { query, limit = 10, threshold = 0.7, node_types } = params;
    const service = this.createService(config);
    
    try {
      await service.verifyConnection();

      const targetLabels = node_types || ["KnowledgeItem"];
      const results = await service.semanticSearch(
        query,
        targetLabels,
        "embedding_vectors",
        limit
      );

      // Filter by threshold
      const filteredResults = results.filter(
        (result: any) => result.score >= threshold
      );

      if (filteredResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No memories found for query: "${query}" with similarity threshold ${threshold}\n\nThis might mean:\n- This is new knowledge not yet in your memory\n- Try a lower threshold or different search terms\n- Consider if this concept needs to be stored in your memory`,
            },
          ],
        };
      }

      const resultText = filteredResults
        .map((result: any, index: number) => {
          const properties = Object.entries(result)
            .filter(([key]) => key !== "embeddings" && key !== "score")
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");
          
          return `${index + 1}. [Similarity: ${result.score.toFixed(3)}]\n   ${properties}`;
        })
        .join("\n\n");

      return {
        content: [
          {
            type: "text", 
            text: `Recalled ${filteredResults.length} relevant memories:\n\n${resultText}`,
          },
        ],
      };
    } catch (error) {
      return handleError(error, "semantic_search");
    } finally {
      await service.close();
    }
  }
}