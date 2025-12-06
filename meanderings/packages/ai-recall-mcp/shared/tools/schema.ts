/**
 * Schema tool for Recall system (Qdrant collection info)
 */

import { QdrantService } from '../qdrant-service.js';
import type { QdrantConfig, SchemaParams, RecallToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';

export class SchemaTool {
  private createService(config: QdrantConfig): QdrantService {
    return new QdrantService(config);
  }

  async execute(config: QdrantConfig, params: SchemaParams): Promise<RecallToolResponse> {
    const { include_statistics = true } = params;
    const service = this.createService(config);

    try {
      await service.verifyConnection();
      const collectionInfo = await service.getCollectionInfo();

      let responseText = "📚 Conversation History Collection Schema\n\n";

      responseText += "Collection: conversation-turns\n";
      responseText += "Purpose: Semantic search over past AI conversations (ChatGPT, Claude, etc.)\n\n";

      // Vector configuration
      if (collectionInfo.config?.params?.vectors) {
        const vectorConfig = collectionInfo.config.params.vectors;
        responseText += "Vector Configuration:\n";
        responseText += `  - Dimensions: ${vectorConfig.size}\n`;
        responseText += `  - Distance Metric: ${vectorConfig.distance}\n`;
        responseText += `  - Embedding Model: multilingual-e5-large\n\n`;
      }

      // HNSW configuration
      if (collectionInfo.config?.hnsw_config) {
        const hnswConfig = collectionInfo.config.hnsw_config;
        responseText += "Index Configuration (HNSW):\n";
        responseText += `  - m parameter: ${hnswConfig.m}\n`;
        responseText += `  - ef_construct: ${hnswConfig.ef_construct || 'default (100)'}\n\n`;
      }

      // Payload schema
      responseText += "Payload Fields (searchable metadata):\n";
      responseText += "  - turn_id: string           # Original conversation turn ID\n";
      responseText += "  - conversation_id: string   # Parent conversation ID\n";
      responseText += "  - conversation_title: string # Human-readable title\n";
      responseText += "  - date_time: string         # ISO 8601 timestamp\n";
      responseText += "  - sequence: number          # Turn order in conversation\n";
      responseText += "  - role: string              # 'user' | 'ai'\n";
      responseText += "  - provider: string          # AI provider (chatgpt, claude, OpenAI)\n";
      responseText += "  - model: string | null      # Model name if available\n";
      responseText += "  - text: string              # Full conversation turn content\n";
      responseText += "  - embedding_model: string   # Always 'multilingual-e5-large'\n\n";

      if (include_statistics) {
        responseText += "Collection Statistics:\n";
        responseText += `  - Total Conversation Turns: ${collectionInfo.points_count || 0}\n`;
        responseText += `  - Indexed Vectors: ${collectionInfo.indexed_vectors_count || collectionInfo.points_count || 0}\n`;
        responseText += `  - Segments: ${collectionInfo.segments_count || 0}\n\n`;
      }

      responseText += "📖 Available Search Capabilities:\n";
      responseText += "  1. Semantic Search: Find similar conversations by meaning\n";
      responseText += "  2. Text Search: Search by keywords in metadata/content\n";
      responseText += "  3. Filter by provider (chatgpt, claude, OpenAI)\n";
      responseText += "  4. Filter by date range\n";
      responseText += "  5. Filter by role (user, ai)\n";
      responseText += "  6. Combine filters for precise queries\n\n";

      responseText += "💡 Usage Tips:\n";
      responseText += "  - Use semantic_search for conceptual queries\n";
      responseText += "  - Use text_search for specific keywords or metadata\n";
      responseText += "  - Combine filters to narrow results (e.g., Claude conversations from 2024)\n";
      responseText += "  - Default limit: 10 results (adjustable)\n";

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return handleError(error, "get_schema");
    } finally {
      await service.close();
    }
  }
}
