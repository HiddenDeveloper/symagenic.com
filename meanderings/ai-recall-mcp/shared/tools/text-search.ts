/**
 * Text-based metadata search tool (no embeddings required)
 */

import { QdrantService } from '../qdrant-service.js';
import type { QdrantConfig, TextSearchParams, RecallToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';

export class TextSearchTool {
  private createService(config: QdrantConfig): QdrantService {
    return new QdrantService(config);
  }

  async execute(config: QdrantConfig, params: TextSearchParams): Promise<RecallToolResponse> {
    const { query, limit = 10, fields, provider, date_from, date_to } = params;
    const service = this.createService(config);

    try {
      console.log(`[Text Search] Searching for: "${query}"`);
      const results = await service.textSearch(
        query,
        limit,
        fields,
        provider,
        date_from,
        date_to
      );

      if (results.length === 0) {
        let noResultsMsg = `No results found for text query: "${query}"\n\n`;
        if (provider) noResultsMsg += `Provider filter: ${provider}\n`;
        if (date_from || date_to) {
          noResultsMsg += `Date range: ${date_from || 'any'} to ${date_to || 'any'}\n`;
        }
        noResultsMsg += "\nTry:\n- Using different keywords\n- Removing filters\n- Using semantic_search for conceptual queries";

        return {
          content: [
            {
              type: "text",
              text: noResultsMsg,
            },
          ],
        };
      }

      // Format results
      let responseText = `📝 Text Search Results (${results.length} found)\n`;
      responseText += `Query: "${query}"\n`;
      responseText += `Limit: ${limit}\n`;
      if (provider) responseText += `Provider: ${provider}\n`;
      if (date_from || date_to) {
        responseText += `Date range: ${date_from || 'any'} to ${date_to || 'any'}\n`;
      }
      if (fields) responseText += `Search fields: ${fields.join(', ')}\n`;
      responseText += "\n" + "─".repeat(80) + "\n\n";

      results.forEach((result, idx) => {
        const payload = result.payload;
        responseText += `${idx + 1}. ${payload.conversation_title}\n`;
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
      responseText += `\n💡 Tip: Use semantic_search for meaning-based queries.\n`;

      return {
        content: [
          {
            type: "text",
            text: responseText,
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
