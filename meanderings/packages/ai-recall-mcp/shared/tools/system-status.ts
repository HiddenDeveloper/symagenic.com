/**
 * System status tool for Recall system
 */

import { QdrantService } from '../qdrant-service.js';
import type { QdrantConfig, RecallToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';

export class SystemStatusTool {
  private createService(config: QdrantConfig): QdrantService {
    return new QdrantService(config);
  }

  async execute(config: QdrantConfig): Promise<RecallToolResponse> {
    const service = this.createService(config);

    try {
      await service.verifyConnection();
      const collectionInfo = await service.getCollectionInfo();

      let responseText = "✅ Recall System Status\n\n";

      responseText += "Service Health:\n";
      responseText += "  - Qdrant Connection: ✅ Connected\n";
      responseText += `  - Collection: ${config.collection}\n`;
      responseText += `  - Collection Status: ✅ Available\n\n`;

      responseText += "Collection Statistics:\n";
      responseText += `  - Total Conversation Turns: ${collectionInfo.points_count || 0}\n`;
      responseText += `  - Indexed Vectors: ${collectionInfo.indexed_vectors_count || collectionInfo.points_count || 0}\n`;
      responseText += `  - Segments: ${collectionInfo.segments_count || 0}\n\n`;

      if (collectionInfo.config?.params?.vectors) {
        const vectorConfig = collectionInfo.config.params.vectors;
        responseText += "Vector Configuration:\n";
        responseText += `  - Dimensions: ${vectorConfig.size}\n`;
        responseText += `  - Distance: ${vectorConfig.distance}\n`;
        responseText += `  - Embedding Model: multilingual-e5-large\n\n`;
      }

      responseText += "Available Tools:\n";
      responseText += "  - get_schema: View collection schema and available filters\n";
      responseText += "  - semantic_search: Search by meaning/concept\n";
      responseText += "  - text_search: Search by keywords in metadata\n";
      responseText += "  - system_status: This status check\n\n";

      responseText += "System: ai-recall-mcp (Conversation History Recall)\n";
      responseText += "Purpose: Semantic search over past AI conversations\n";

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      return handleError(error, "system_status");
    } finally {
      await service.close();
    }
  }
}
