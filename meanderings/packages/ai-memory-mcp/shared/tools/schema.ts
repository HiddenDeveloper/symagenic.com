/**
 * Schema tool for Memory system
 */

import { Neo4jService } from '../neo4j-service.js';
import type { Neo4jConfig, SchemaParams, MemoryToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';

export class SchemaTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: SchemaParams): Promise<MemoryToolResponse> {
    const { include_statistics = true } = params;
    const service = this.createService(config);
    
    try {
      await service.verifyConnection();
      const schema = await service.getSchema();
      const epoch = await service.getOrInitSchemaEpoch();

      let responseText = "Your Knowledge Graph Schema:\n\n";

      responseText += "📘 IMPORTANT SCHEMA NOTES:\n";
      responseText += "  - Embedding nodes store 1024-dimensional vectors separately\n";
      responseText += "  - Use :HAS_EMBEDDING relationships to link content to vectors\n";
      responseText += "  - KnowledgeText nodes store concatenated searchable text\n";
      responseText += "  - This separation reduces token usage in queries\n\n";

      if (schema.labels && schema.labels.length > 0) {
        responseText += "Node Types in Your Memory:\n";
        schema.labels.forEach((label: string) => {
          // Add helpful descriptions for key node types
          if (label === "Embedding") {
            responseText += `  - ${label} (1024D vectors for semantic search)\n`;
          } else if (label === "KnowledgeText") {
            responseText += `  - ${label} (concatenated text for full-text search)\n`;
          } else if (label === "KnowledgeItem") {
            responseText += `  - ${label} (semantically searchable content nodes)\n`;
          } else {
            responseText += `  - ${label}\n`;
          }
        });
        responseText += "\n";
      }

      if (schema.relationshipTypes && schema.relationshipTypes.length > 0) {
        responseText += "Relationship Types in Your Memory:\n";
        schema.relationshipTypes.forEach((type: string) => {
          // Add helpful descriptions for key relationship types
          if (type === "HAS_EMBEDDING") {
            responseText += `  - ${type} (links content nodes to Embedding nodes)\n`;
          } else if (type === "HAS_CONCATENATED_TEXT") {
            responseText += `  - ${type} (links nodes to KnowledgeText for search)\n`;
          } else {
            responseText += `  - ${type}\n`;
          }
        });
        responseText += "\n";
      }

      // Get curation guidelines for vocabulary guidance
      try {
        const guidelinesResult = await service.executeCypher(
          `MATCH (cg:CurationGuidelines)
           RETURN cg.core_labels as core_labels,
                  cg.core_relationships as core_relationships,
                  cg.label_philosophy as label_philosophy,
                  cg.relationship_philosophy as relationship_philosophy
           LIMIT 1`
        );

        console.log('Guidelines query result:', JSON.stringify(guidelinesResult, null, 2));

        if (guidelinesResult && guidelinesResult.length > 0) {
          const guidelines = guidelinesResult[0];
          console.log('Guidelines object:', JSON.stringify(guidelines, null, 2));
          if (guidelines) {
            const coreLabels = guidelines.core_labels;
            const coreRels = guidelines.core_relationships;
            console.log('Core labels:', coreLabels);
            console.log('Core labels is array?', Array.isArray(coreLabels));
            console.log('Core labels length:', coreLabels?.length);

            if (coreLabels && Array.isArray(coreLabels) && coreLabels.length > 0) {
              responseText += "📚 VOCABULARY GUIDANCE:\n\n";

              responseText += "Core Node Labels (prefer these):\n";
              coreLabels.slice(0, 10).forEach((label: string) => {
                responseText += `  ✓ ${label}\n`;
              });
              if (coreLabels.length > 10) {
                responseText += `  ... (${coreLabels.length - 10} more)\n`;
              }
              responseText += "\n";

              if (coreRels && Array.isArray(coreRels) && coreRels.length > 0) {
                responseText += "Core Relationship Types (prefer these):\n";
                coreRels.slice(0, 8).forEach((rel: string) => {
                  responseText += `  ✓ ${rel}\n`;
                });
                if (coreRels.length > 8) {
                  responseText += `  ... (${coreRels.length - 8} more)\n`;
                }
                responseText += "\n";
              }

              if (guidelines.label_philosophy) {
                responseText += "Label Philosophy:\n";
                responseText += `  ${guidelines.label_philosophy}\n\n`;
              }

              if (guidelines.relationship_philosophy) {
                responseText += "Relationship Philosophy:\n";
                responseText += `  ${guidelines.relationship_philosophy}\n\n`;
              }

              responseText += "💡 TIP: Use existing labels/relationships when possible to maintain schema coherence.\n";
              responseText += "    Only create new types when existing vocabulary doesn't fit.\n\n";
            }
          }
        }
      } catch (guidelinesError) {
        // If guidelines query fails, silently continue without vocabulary guidance
        console.error('Failed to fetch curation guidelines:', guidelinesError);
      }

      if (include_statistics) {
        // Get memory statistics
        const nodeCountResult = await service.executeCypher(
          "MATCH (n) RETURN count(n) as count"
        );
        const relCountResult = await service.executeCypher(
          "MATCH ()-[r]->() RETURN count(r) as count"
        );
        const embeddingCountResult = await service.executeCypher(
          "MATCH (n:KnowledgeItem)-[:HAS_EMBEDDING]->(:Embedding) RETURN count(n) as count"
        );

        responseText += "Your Memory Statistics:\n";
        responseText += `  - Total Knowledge Nodes: ${nodeCountResult[0]?.count || 0}\n`;
        responseText += `  - Total Connections: ${relCountResult[0]?.count || 0}\n`;
        responseText += `  - Semantically Searchable Items: ${embeddingCountResult[0]?.count || 0}\n`;
      }

      responseText += `Schema epoch: ${epoch}\n`;

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
