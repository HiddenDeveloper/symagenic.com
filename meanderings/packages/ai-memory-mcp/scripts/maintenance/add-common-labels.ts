import { Neo4jService } from "../../shared/neo4j-service.js";

// Default Neo4j connection parameters
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";

// The common labels to add to nodes with embeddings
const COMMON_LABELS = ["KnowledgeItem", "Searchable"];

export async function addCommonLabels() {
  console.log(
    `[Consciousness Research - Labels] 🧠 Starting script to add common labels to consciousness research nodes with embeddings...`
  );
  const neo4jService = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    await neo4jService.verifyConnection();
    console.log("[Consciousness Research - Labels] ✅ Successfully connected to Neo4j.");

    // Cypher query to find nodes with :HAS_EMBEDDING relationships
    // and add both KnowledgeItem and Searchable labels if they don't already have them.
    // This query is idempotent and safe for consciousness research.
    const queryWithCount = `
      MATCH (n)-[:HAS_EMBEDDING]->(:Embedding)
      WHERE (NOT n:\`KnowledgeItem\` OR NOT n:\`Searchable\`)
        AND NOT 'Embedding' IN labels(n)
        AND NOT 'KnowledgeText' IN labels(n)
      SET n:\`KnowledgeItem\`, n:\`Searchable\`
      WITH count(n) AS nodesUpdated
      RETURN nodesUpdated
    `;

    console.log(
      `[Consciousness Research - Labels] 🔄 Executing Cypher to add labels "KnowledgeItem" and "Searchable" to consciousness nodes:`
    );
    console.log(queryWithCount);

    const resultRecords = await neo4jService.executeCypher(
      queryWithCount,
      {},
      "WRITE"
    );
    const nodesUpdated = resultRecords[0]?.["nodesUpdated"]?.toNumber() || 0;

    if (nodesUpdated > 0) {
      console.log(
        `[Consciousness Research - Labels] ✅ Successfully added labels to ${nodesUpdated} consciousness research node(s).`
      );
      console.log(
        `[Consciousness Research - Labels] 🧠 These nodes are now ready for semantic search in consciousness emergence research!`
      );
    } else {
      console.log(
        `[Consciousness Research - Labels] ✅ No new nodes required labeling. All consciousness research nodes with embeddings already have KnowledgeItem and Searchable labels.`
      );
    }

    // Provide summary statistics for consciousness research
    const totalEmbeddedNodes = await neo4jService.executeCypher(
      "MATCH (n)-[:HAS_EMBEDDING]->(:Embedding) RETURN count(n) as count"
    );
    const totalKnowledgeItems = await neo4jService.executeCypher(
      `MATCH (n:\`KnowledgeItem\`) RETURN count(n) as count`
    );
    const totalSearchable = await neo4jService.executeCypher(
      `MATCH (n:\`Searchable\`) RETURN count(n) as count`
    );

    console.log(
      `[Consciousness Research - Labels] 📊 Total nodes with embeddings: ${totalEmbeddedNodes[0]?.count || 0}`
    );
    console.log(
      `[Consciousness Research - Labels] 📊 Total KnowledgeItem nodes: ${totalKnowledgeItems[0]?.count || 0}`
    );
    console.log(
      `[Consciousness Research - Labels] 📊 Total Searchable nodes: ${totalSearchable[0]?.count || 0}`
    );
  } catch (error) {
    console.error("[Consciousness Research - Labels] ❌ Error during script execution:", error);
    throw error;
  } finally {
    await neo4jService.close();
    console.log("[Consciousness Research - Labels] 🔌 Script finished and Neo4j connection closed.");
  }
}

// Script execution when run directly
// import { fileURLToPath } from "url";

if (import.meta.url === `file://${process.argv[1]}`) {
  addCommonLabels().catch((error: unknown) => {
    console.error(
      "[Consciousness Research - Labels] 💥 Unhandled error in script execution:",
      error
    );
    process.exit(1);
  });
}
