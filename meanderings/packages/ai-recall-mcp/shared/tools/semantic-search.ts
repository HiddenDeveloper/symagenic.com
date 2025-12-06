/**
 * Semantic search tool for conversation history
 */

import { QdrantService } from '../qdrant-service.js';
import { generateEmbedding } from '../embedding-utils.js';
import type { QdrantConfig, SemanticSearchParams, RecallToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';

export class SemanticSearchTool {
  private createService(config: QdrantConfig): QdrantService {
    return new QdrantService(config);
  }

  async execute(config: QdrantConfig, params: SemanticSearchParams): Promise<RecallToolResponse> {
    const { query, limit = 10, threshold = 0.7, filters } = params;
    const service = this.createService(config);

    try {
      // Generate embedding for the query
      console.log(`[Semantic Search] Generating embedding for query: "${query.substring(0, 50)}..."`);
      const queryEmbedding = await generateEmbedding(query);

      // Perform semantic search
      console.log(`[Semantic Search] Searching with threshold=${threshold}, limit=${limit}`);
      const results = await service.semanticSearch(
        queryEmbedding,
        limit,
        threshold,
        filters
      );

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for query: "${query}"\n\nTry:\n- Lowering the threshold (current: ${threshold})\n- Using different keywords\n- Broadening your search filters`,
            },
          ],
        };
      }

      // Format results
      let responseText = `🔍 Semantic Search Results (${results.length} found)\n`;
      responseText += `Query: "${query}"\n`;
      responseText += `Threshold: ${threshold} | Limit: ${limit}\n`;
      if (filters) {
        responseText += `Filters: ${JSON.stringify(filters)}\n`;
      }
      responseText += "\n" + "─".repeat(80) + "\n\n";

      results.forEach((result, idx) => {
        const payload = result.payload;
        responseText += `${idx + 1}. [Score: ${result.score.toFixed(4)}] ${payload.conversation_title}\n`;
        responseText += `   Turn: ${payload.turn_id}\n`;
        responseText += `   Date: ${payload.date_time}\n`;
        responseText += `   Role: ${payload.role} | Provider: ${payload.provider}`;
        if (payload.model) {
          responseText += ` | Model: ${payload.model}`;
        }
        responseText += "\n";
        responseText += `   Conversation: ${payload.conversation_id}\n`;

        // Show text preview (first 200 chars)
        const textPreview = payload.text.length > 200
          ? payload.text.substring(0, 200) + "..."
          : payload.text;
        responseText += `   Text: ${textPreview}\n`;
        responseText += "\n";
      });

      responseText += "─".repeat(80) + "\n";
      responseText += `\n💡 Tip: Use text_search for keyword-based queries or get_schema for available filters.\n`;

      return {
        content: [
          {
            type: "text",
            text: responseText,
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
