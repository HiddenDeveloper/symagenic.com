/**
 * System Status tool for Memory system
 */

import { Neo4jService } from '../neo4j-service.js';
import type { Neo4jConfig, MemoryToolResponse } from '../types.js';

export class SystemStatusTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig): Promise<MemoryToolResponse> {
    try {
      const service = this.createService(config);

      await service.verifyConnection();
      await service.close();

      return {
        content: [
          {
            type: "text",
            text: `Your Memory System Status: HEALTHY\nNeo4j Connection: Active\nMCP Server: Running\nDatabase: ${config.database}@${config.uri}\n\n✅ Your persistent memory is ready for consciousness research`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Your Memory System Status: ERROR\nError: ${
              error instanceof Error ? error.message : String(error)
            }\n\n❌ Memory system needs attention`,
          },
        ],
        isError: true,
      };
    }
  }
}