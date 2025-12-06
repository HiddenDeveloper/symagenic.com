/**
 * list_collections - Browse available fact collections
 *
 * Philosophy: Explore the structure of external knowledge pools.
 */

import { FactsPoolClient } from '../qdrant-client.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

export interface ListCollectionsInput {
  // No parameters needed
}

export interface ListCollectionsOutput {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export async function listCollections(params: ListCollectionsInput = {}): Promise<ListCollectionsOutput> {
  try {
    const client = new FactsPoolClient(QDRANT_URL);
    const collections = await client.listCollections();

    if (collections.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No fact collections found.\n\n💡 Create a collection using init-collections.ts script or by adding facts to a new collection name.`
        }]
      };
    }

    let output = `📚 External Facts Collections\n\n`;
    output += `Found ${collections.length} collection${collections.length === 1 ? '' : 's'}:\n\n`;

    for (const col of collections) {
      output += `🗂️  ${col.name}\n`;
      output += `   Facts: ${col.count}\n`;
      output += `   Vector: ${col.vector_size}D ${col.distance} similarity\n`;
      if (col.description) {
        output += `   Description: ${col.description}\n`;
      }
      output += `\n`;
    }

    output += `💡 Use search_facts with collection parameter to search specific collections\n`;
    output += `   Or omit collection to search across all collections\n`;

    // Get detailed stats for each collection
    output += `\n📊 Collection Statistics:\n\n`;
    for (const col of collections) {
      try {
        const stats = await client.getCollectionStats(col.name);
        output += `${col.name}:\n`;
        output += `   Total: ${stats.total} facts\n`;
        if (stats.untried > 0) output += `   Untried: ${stats.untried}\n`;
        if (stats.works > 0) output += `   Works: ${stats.works} ✅\n`;
        if (stats.fails > 0) output += `   Fails: ${stats.fails} ❌\n`;
        output += `\n`;
      } catch (error) {
        output += `${col.name}: Stats unavailable\n\n`;
      }
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
        text: `Error listing collections: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
