/**
 * Text Search tool for Memory system using APOC
 */

import { Neo4jService } from '../neo4j-service.js';
import type { Neo4jConfig, TextSearchParams, MemoryToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';

export class TextSearchTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: TextSearchParams): Promise<MemoryToolResponse> {
    const { query, node_types, properties, fuzzy = false, limit = 10 } = params;
    const service = this.createService(config);
    
    try {
      await service.verifyConnection();

      const targetLabels = node_types || [];
      const searchProperties = properties || [];
      
      const results = await service.textSearch(
        query,
        targetLabels,
        searchProperties,
        fuzzy,
        Math.floor(limit) // Ensure integer limit
      );

      if (results.length === 0) {
        const searchMode = fuzzy ? "fuzzy text search" : "exact text search";
        const labelFilter = targetLabels.length > 0 ? ` in ${targetLabels.join(', ')} nodes` : "";
        const propertyFilter = searchProperties.length > 0 ? ` within properties: ${searchProperties.join(', ')}` : "";
        
        return {
          content: [
            {
              type: "text",
              text: `No results found for ${searchMode}: "${query}"${labelFilter}${propertyFilter}\n\nSuggestions:\n- Try fuzzy search if using exact match\n- Check spelling or try alternative terms\n- Expand search to more node types\n- Use semantic_search for meaning-based results`,
            },
          ],
        };
      }

      const resultText = results
        .map((result: any, index: number) => {
          const properties = Object.entries(result)
            .filter(([key]) => key !== "embeddings" && key !== "relevance")
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");
          
          const relevanceScore = result.relevance ? `[Relevance: ${result.relevance.toFixed(3)}]` : "";
          return `${index + 1}. ${relevanceScore}\n   ${properties}`;
        })
        .join("\n\n");

      const searchType = fuzzy ? "Fuzzy text search" : "Text search";
      const searchInfo = targetLabels.length > 0 || searchProperties.length > 0 
        ? ` (${[
            targetLabels.length > 0 ? `types: ${targetLabels.join(', ')}` : '',
            searchProperties.length > 0 ? `properties: ${searchProperties.join(', ')}` : ''
          ].filter(Boolean).join(', ')})`
        : "";

      return {
        content: [
          {
            type: "text", 
            text: `${searchType} for "${query}" found ${results.length} matches${searchInfo}:\n\n${resultText}`,
          },
        ],
      };
    } catch (error) {
      return handleError(error, "text_search");
    } finally {
      await service.close();
    }
  }
}