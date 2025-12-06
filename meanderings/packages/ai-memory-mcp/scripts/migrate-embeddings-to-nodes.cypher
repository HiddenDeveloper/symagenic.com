// Migration Script: Extract Embeddings and KnowledgeItem to Separate Nodes
// Purpose: Remove embeddings and KnowledgeItem properties from main nodes,
//          storing them as separate linked nodes to reduce token usage in queries
//
// Run this script with: cypher-shell -u neo4j -p testpassword123 < migrate-embeddings-to-nodes.cypher
// Or via execute_cypher tool in batches

// ============================================================================
// STEP 1: Extract existing embeddings to Embedding nodes
// ============================================================================

MATCH (n)
WHERE n.embeddings IS NOT NULL
WITH n, n.embeddings as embeddingVector
CREATE (e:Embedding {
  vector: embeddingVector,
  dimension: size(embeddingVector),
  model: 'all-MiniLM-L6-v2',
  created: datetime(),
  source: 'migration_from_node_property'
})
CREATE (n)-[:HAS_EMBEDDING {
  created: datetime(),
  model: 'all-MiniLM-L6-v2'
}]->(e)
WITH n, e
REMOVE n.embeddings
RETURN count(n) as nodes_migrated,
       count(e) as embeddings_created;

// ============================================================================
// STEP 2: Extract KnowledgeItem concatenated text to KnowledgeText nodes
// ============================================================================

MATCH (n)
WHERE n.KnowledgeItem IS NOT NULL
WITH n, n.KnowledgeItem as concatenatedText
CREATE (kt:KnowledgeText {
  text: concatenatedText,
  created: datetime(),
  source: 'migration_from_node_property'
})
CREATE (n)-[:HAS_CONCATENATED_TEXT {
  created: datetime()
}]->(kt)
WITH n, kt
REMOVE n.KnowledgeItem
RETURN count(n) as nodes_migrated,
       count(kt) as knowledge_texts_created;

// ============================================================================
// STEP 3: Verify migration results
// ============================================================================

// Count nodes that still have embeddings property (should be 0)
MATCH (n)
WHERE n.embeddings IS NOT NULL
RETURN 'ERROR: Nodes still have embeddings property' as status,
       count(n) as remaining_count;

// Count nodes that still have KnowledgeItem property (should be 0)
MATCH (n)
WHERE n.KnowledgeItem IS NOT NULL
RETURN 'ERROR: Nodes still have KnowledgeItem property' as status,
       count(n) as remaining_count;

// Count successful migrations
MATCH (n)-[:HAS_EMBEDDING]->(e:Embedding)
RETURN 'SUCCESS: Embeddings migrated' as status,
       count(n) as nodes_with_embeddings;

MATCH (n)-[:HAS_CONCATENATED_TEXT]->(kt:KnowledgeText)
RETURN 'SUCCESS: KnowledgeText migrated' as status,
       count(n) as nodes_with_text;

// ============================================================================
// STEP 4: Update schema epoch (for cache invalidation)
// ============================================================================

MERGE (epoch:SchemaEpoch {key: 'SCHEMA_VERSION'})
SET epoch.version = coalesce(epoch.version, 0) + 1,
    epoch.last_updated = datetime(),
    epoch.change_description = 'Migrated embeddings and KnowledgeItem to separate nodes',
    epoch.migration_date = datetime()
RETURN epoch.version as new_schema_version;
