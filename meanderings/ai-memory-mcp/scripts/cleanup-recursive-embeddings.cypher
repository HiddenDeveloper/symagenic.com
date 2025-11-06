// Clean up recursive embeddings - delete embeddings FOR Embedding and KnowledgeText nodes
// Run this multiple times until it returns 0

// Batch 1: Delete embeddings for Embedding nodes
MATCH (e1:Embedding)-[:HAS_EMBEDDING]->(e2:Embedding)
WITH e2 LIMIT 50000
DETACH DELETE e2
RETURN count(e2) as embeddings_deleted;

// Batch 2: Delete embeddings for KnowledgeText nodes
MATCH (kt:KnowledgeText)-[:HAS_EMBEDDING]->(e:Embedding)
WITH e LIMIT 10000
DETACH DELETE e
RETURN count(e) as knowledge_text_embeddings_deleted;

// Batch 3: Delete orphaned Embedding nodes (not connected to anything)
MATCH (e:Embedding)
WHERE NOT exists((e)<-[:HAS_EMBEDDING]-())
WITH e LIMIT 10000
DELETE e
RETURN count(e) as orphaned_deleted;

// Check remaining
MATCH (e1:Embedding)-[:HAS_EMBEDDING]->(e2:Embedding)
RETURN count(e2) as remaining_embedding_recursions;

MATCH (kt:KnowledgeText)-[:HAS_EMBEDDING]->(e:Embedding)
RETURN count(e) as remaining_knowledge_text_embeddings;

MATCH (e:Embedding)
WHERE NOT exists((e)<-[:HAS_EMBEDDING]-())
RETURN count(e) as remaining_orphaned;
