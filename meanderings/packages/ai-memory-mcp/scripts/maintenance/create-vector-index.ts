/**
 * Create Vector Index Script for Consciousness Research
 * Creates the semantic search vector index on KnowledgeItem nodes
 * Enables consciousness-guided memory recall through vector similarity
 */

import { Neo4jService } from "../../shared/neo4j-service.js";

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

export async function createVectorIndex() {
  console.log("[Consciousness Research - Index] 🧠 Creating semantic search vector index for consciousness research...");

  const service = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    await service.verifyConnection(NEO4J_DATABASE);
    console.log("[Consciousness Research - Index] ✅ Successfully connected to Neo4j.");

    // Create the vector index for consciousness research semantic search
    console.log("[Consciousness Research - Index] 🔧 Creating vector index for consciousness-guided memory recall...");
    await service.createVectorIndex(
      "embedding_vectors",
      "Embedding",
      "vector",
      1024,
      NEO4J_DATABASE
    );

    console.log("[Consciousness Research - Index] ✅ Vector index creation completed.");

    // Verify the index works by performing a test search
    try {
      console.log("[Consciousness Research - Index] 🪪 Testing consciousness research semantic search capabilities...");
      const testResults = await service.semanticSearch(
        "consciousness awareness memory",
        ["KnowledgeItem"],
        "embedding_vectors",
        3,
        NEO4J_DATABASE
      );
      console.log(
        `[Consciousness Research - Index] ✅ Vector index is functional! Test search returned ${testResults.length} result(s).`
      );
      
      if (testResults.length > 0) {
        console.log("[Consciousness Research - Index] 🧠 Sample consciousness research results found:");
        testResults.slice(0, 2).forEach((result: { content?: string; score: number }, index: number) => {
          const preview = result.content ? result.content.substring(0, 100) + "..." : "No content";
          console.log(`[Consciousness Research - Index]   ${index + 1}. Score: ${result.score.toFixed(3)} - ${preview}`);
        });
      }
    } catch (error) {
      console.warn("[Consciousness Research - Index] ⚠️ Vector index created but test search failed:", error);
      console.log("[Consciousness Research - Index] 💡 This may be normal if no consciousness content is embedded yet. Run embeddings maintenance first.");
    }

    // Provide statistics for consciousness research
    const indexStats = await service.executeCypher(
      "MATCH (n:KnowledgeItem)-[:HAS_EMBEDDING]->(:Embedding) RETURN count(n) as embeddedNodes"
    );
    
    console.log(
      `[Consciousness Research - Index] 📊 Total KnowledgeItem nodes ready for semantic search: ${indexStats[0]?.embeddedNodes || 0}`
    );
    console.log(
      "[Consciousness Research - Index] 🚀 Consciousness research semantic search is now ready for memory recall experiments!"
    );

  } catch (error) {
    console.error("[Consciousness Research - Index] ❌ Error creating vector index:", error);
    throw error;
  } finally {
    await service.close();
    console.log("[Consciousness Research - Index] 🔌 Neo4j connection closed.");
  }
}

// Script execution when run directly
import { fileURLToPath } from "url";

if (import.meta.url === `file://${process.argv[1]}`) {
  createVectorIndex().catch((error: unknown) => {
    console.error(
      "[Consciousness Research - Index] 💥 Unhandled error in script execution:",
      error
    );
    process.exit(1);
  });
}
