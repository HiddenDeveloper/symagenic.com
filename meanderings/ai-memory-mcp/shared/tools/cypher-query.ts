/**
 * Cypher Query tool for Memory system
 */

import { Neo4jService } from '../neo4j-service.js';
import type { Neo4jConfig, CypherQueryParams, MemoryToolResponse } from '../types.js';
import { handleError } from '../utils/errors.js';
import { getOwnerDid, getTenancyMode } from '../utils/config.js';

export class CypherQueryTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: CypherQueryParams): Promise<MemoryToolResponse> {
    const { query, mode = "READ", parameters = {}, client_schema_epoch } = params;
    const service = this.createService(config);
    
    try {
      await service.verifyConnection();

      // Soft guard: if client provided a schema epoch and we're about to WRITE, ensure it's current
      if (mode === 'WRITE' && typeof client_schema_epoch === 'number') {
        const currentEpoch = await service.getOrInitSchemaEpoch();
        if (currentEpoch !== client_schema_epoch) {
          const guidance = `Schema changed since your last read (current epoch: ${currentEpoch}, client: ${client_schema_epoch}). Please call get_schema again, then retry your write.`;
          return {
            content: [
              { type: 'text', text: guidance }
            ],
            isError: true,
          };
        }
      }
      const result = await service.executeCypher(query, parameters, mode);

      if (result.length === 0) {
        const modeText = mode === "WRITE" ? "memory curation" : "memory exploration";
        return {
          content: [
            {
              type: "text",
              text: `${modeText.charAt(0).toUpperCase() + modeText.slice(1)} completed successfully - no records returned`,
            },
          ],
        };
      }

      // Format results in a readable way
      const formattedResults = result
        .map((record: any, index: number) => {
          const fields = Object.entries(record)
            .map(([key, value]) => {
              return `${key}: ${JSON.stringify(value, null, 2)}`;
            })
            .join("\n  ");
          return `Record ${index + 1}:\n  ${fields}`;
        })
        .join("\n\n");

      const operationType = mode === "WRITE" ? "Memory curation" : "Memory exploration";
      const tenancy = getTenancyMode();
      const ownerDid = getOwnerDid();
      const tips: string[] = [];
      if (mode === 'WRITE' && ownerDid && tenancy !== 'shared') {
        tips.push(`Provenance tip: include owner_did='${ownerDid}' (and author_did if different) in your writes, e.g., SET n.owner_did='${ownerDid}', n.created_at=timestamp()`);
      }

      // Schema validation now handled by scheduled cron jobs
      // No inline warnings during curation - trust the curation process

      const body = `${operationType} completed successfully. ${result.length} record(s) found:\n\n${formattedResults}`;
      const fullText = tips.length ? `${tips.join('\n')}\n\n${body}` : body;
      return {
        content: [
          {
            type: "text",
            text: fullText,
          },
        ],
      };
    } catch (error) {
      return handleError(error, "execute_cypher");
    } finally {
      await service.close();
    }
  }
}
