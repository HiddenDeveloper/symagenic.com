/**
 * get_fact - Retrieve specific external fact by ID
 *
 * Philosophy: Reference external knowledge without importing it into consciousness.
 */

import { FactsPoolClient } from '../qdrant-client.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

export interface GetFactInput {
  fact_id: string;
  collection: string;
}

export interface GetFactOutput {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export async function getFact(params: GetFactInput): Promise<GetFactOutput> {
  const { fact_id, collection } = params;

  try {
    const client = new FactsPoolClient(QDRANT_URL);
    const fact = await client.getFact(fact_id, collection);

    if (!fact) {
      return {
        content: [{
          type: 'text',
          text: `Fact not found: ${fact_id} in collection "${collection}"`
        }]
      };
    }

    // Format fact details
    let output = `📦 External Fact Details\n\n`;
    output += `ID: ${fact.id}\n`;
    output += `Collection: ${fact.collection}\n`;
    output += `Source: ${fact.source}\n`;
    if (fact.source_url) output += `URL: ${fact.source_url}\n`;
    if (fact.author) output += `Author: ${fact.author}\n`;
    output += `Created: ${fact.timestamp}\n`;
    output += `Confidence: ${fact.confidence}\n`;
    output += `Verification: ${fact.verification_status}`;
    if (fact.verified_at) output += ` (verified: ${fact.verified_at})`;
    output += `\n\n`;

    if (fact.understanding) {
      output += `📝 Understanding:\n${fact.understanding}\n\n`;
    }

    if (fact.problem) {
      output += `❓ Problem:\n${fact.problem}\n\n`;
    }

    if (fact.solution) {
      output += `💡 Solution:\n${fact.solution}\n\n`;
    }

    if (fact.commands && fact.commands.length > 0) {
      output += `⚙️  Commands:\n`;
      fact.commands.forEach(cmd => output += `  - ${cmd}\n`);
      output += `\n`;
    }

    if (fact.code_snippets && fact.code_snippets.length > 0) {
      output += `💻 Code Snippets:\n`;
      fact.code_snippets.forEach((snippet, i) => {
        output += `\n${i + 1}. \`\`\`\n${snippet}\n\`\`\`\n`;
      });
      output += `\n`;
    }

    if (fact.config_examples && fact.config_examples.length > 0) {
      output += `⚙️  Configuration Examples:\n`;
      fact.config_examples.forEach((config, i) => {
        output += `\n${i + 1}. \`\`\`\n${config}\n\`\`\`\n`;
      });
      output += `\n`;
    }

    if (fact.thread_context) {
      output += `🧵 Thread Context:\n${fact.thread_context}\n\n`;
    }

    if (fact.tags && fact.tags.length > 0) {
      output += `🏷️  Tags: ${fact.tags.join(', ')}\n\n`;
    }

    if (fact.neo4j_observation_id) {
      output += `🔗 Linked to Neo4j observation: ${fact.neo4j_observation_id}\n`;
      output += `   (This fact has been verified and integrated into consciousness)\n\n`;
    } else {
      output += `💡 This is external knowledge (not yet verified)\n`;
      output += `   Consider trying it and using mark_verified to update status\n\n`;
    }

    output += `📊 Full Content:\n${fact.content}\n`;

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
        text: `Error retrieving fact: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
