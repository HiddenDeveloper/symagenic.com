/**
 * Initialize Qdrant Facts Pool Collections
 *
 * Sets up the initial collection structure for external knowledge storage.
 */

import { FactsPoolClient } from '../shared/qdrant-client.js';

async function initializeCollections() {
  console.log('🚀 Initializing Qdrant Facts Pool Collections...\n');

  const client = new FactsPoolClient('http://localhost:6333');

  // Discord Solutions Collection
  await client.createCollection(
    'discord-solutions',
    'Actionable solutions and knowledge extracted from Discord conversations'
  );

  // Future collections (commented out for now)
  // await client.createCollection(
  //   'stackoverflow-facts',
  //   'Solutions and code snippets from Stack Overflow'
  // );

  // await client.createCollection(
  //   'documentation-refs',
  //   'Official documentation snippets and guides'
  // );

  // await client.createCollection(
  //   'api-knowledge',
  //   'API usage patterns and examples'
  // );

  console.log('\n✅ Collections initialized successfully!');
  console.log('\nAvailable collections:');
  const collections = await client.listCollections();
  for (const col of collections) {
    console.log(`  - ${col.name} (${col.count} facts, ${col.vector_size}D ${col.distance})`);
  }
}

initializeCollections().catch(console.error);
