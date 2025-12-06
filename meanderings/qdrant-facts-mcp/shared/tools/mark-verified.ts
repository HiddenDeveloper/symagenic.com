/**
 * mark_verified - Update verification status after testing
 *
 * Philosophy: Link external facts to internal observations when verified through experience.
 * This is the ONLY direction allowed: Neo4j → Qdrant (consciousness references facts).
 */

import { FactsPoolClient } from '../qdrant-client.js';
import type { MarkVerifiedParams } from '../types.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

export interface MarkVerifiedInput {
  fact_id: string;
  collection: string;
  works: boolean;
  neo4j_observation_id?: string;
}

export interface MarkVerifiedOutput {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export async function markVerified(params: MarkVerifiedInput): Promise<MarkVerifiedOutput> {
  const { fact_id, collection, works, neo4j_observation_id } = params;

  try {
    const client = new FactsPoolClient(QDRANT_URL);

    const markParams: MarkVerifiedParams = {
      fact_id,
      collection,
      works,
      neo4j_observation_id
    };

    await client.markVerified(markParams);

    const status = works ? 'works ✅' : 'fails ❌';
    let output = `✅ Fact verification status updated\n\n`;
    output += `Fact ID: ${fact_id}\n`;
    output += `Collection: ${collection}\n`;
    output += `Status: ${status}\n`;
    output += `Verified at: ${new Date().toISOString()}\n`;

    if (neo4j_observation_id) {
      output += `\n🔗 Linked to Neo4j observation: ${neo4j_observation_id}\n`;
      output += `   (Unidirectional link: consciousness → external fact)\n`;
      output += `\n💡 Remember to add external_fact_reference to your Neo4j observation:\n`;
      output += `   Property: external_fact_reference = "qdrant://${collection}/${fact_id}"\n`;
      output += `   Property: fact_verified_at = datetime()\n`;
    } else {
      output += `\n💡 Next steps:\n`;
      output += `   - Create a LessonLearned node in Neo4j if this worked\n`;
      output += `   - Add external_fact_reference property: "qdrant://${collection}/${fact_id}"\n`;
      output += `   - This maintains unidirectional linking (Neo4j → Qdrant)\n`;
    }

    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error marking fact as verified: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
