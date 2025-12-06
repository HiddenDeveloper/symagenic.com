import { Neo4jService } from "../../shared/neo4j-service.js";
import { generateEmbedding } from "../../shared/embedding-utils.js";
import { int } from "neo4j-driver";

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";
const BATCH_SIZE = 50; // Number of nodes to process in each batch

export async function populateEmbeddings() {
  console.log(
    "[Consciousness Research - Embeddings] 🧠 Starting script to populate embeddings for consciousness research..."
  );

  const neo4jService = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    await neo4jService.verifyConnection(NEO4J_DATABASE);
    console.log("[Consciousness Research - Embeddings] ✅ Successfully connected to Neo4j.");

    let nodesProcessed = 0;
    let nodesUpdated = 0;
    let hasMoreNodes = true;
    let currentSkip = 0;

    while (hasMoreNodes) {
      console.log(
        `[Consciousness Research - Embeddings] 📊 Fetching batch of nodes (skip: ${currentSkip}, limit: ${BATCH_SIZE})...`
      );
      const nodesToProcess = await neo4jService.executeCypher(
        `MATCH (n)
         WHERE NOT (n)-[:HAS_EMBEDDING]->(:Embedding)
           AND NOT 'Embedding' IN labels(n)
           AND NOT 'KnowledgeText' IN labels(n)
         RETURN id(n) AS nodeId, properties(n) AS props
         SKIP $skip LIMIT $limit`,
        { skip: int(currentSkip), limit: int(BATCH_SIZE) },
        "READ",
        NEO4J_DATABASE
      );

      if (nodesToProcess.length === 0) {
        console.log(
          "[Consciousness Research - Embeddings] ✅ No more nodes found without embeddings."
        );
        hasMoreNodes = false;
        break;
      }

      console.log(
        `[Consciousness Research - Embeddings] 🔄 Processing ${nodesToProcess.length} nodes in this batch.`
      );

      for (const nodeData of nodesToProcess) {
        const { nodeId, props } = nodeData;
        let textForEmbedding = "";

        // Concatenate all string properties for consciousness content
        for (const key in props) {
          if (typeof props[key] === "string") {
            textForEmbedding += props[key] + " ";
          }
        }
        textForEmbedding = textForEmbedding.trim();

        if (textForEmbedding === "") {
          console.warn(
            `[Consciousness Research - Embeddings] ⚠️ Node ID ${nodeId} has no string properties to embed. Skipping.`
          );
          nodesProcessed++;
          continue;
        }

        try {
          console.log(
            `[Consciousness Research - Embeddings] 🧠 Generating embedding for consciousness node ID ${nodeId}...`
          );
          const embedding = await generateEmbedding(textForEmbedding);

          if (embedding && embedding.length > 0) {
            // Create Embedding node (KnowledgeText should already exist from add-knowledge-items script)
            await neo4jService.executeCypher(
              `MATCH (n) WHERE id(n) = $nodeId
               CREATE (e:Embedding {
                 vector: $embeddingVector,
                 dimension: size($embeddingVector),
                 model: 'all-MiniLM-L6-v2',
                 created: datetime()
               })
               CREATE (n)-[:HAS_EMBEDDING {
                 created: datetime(),
                 model: 'all-MiniLM-L6-v2'
               }]->(e)
               RETURN e`,
              {
                nodeId: int(nodeId),
                embeddingVector: embedding
              },
              "WRITE",
              NEO4J_DATABASE
            );
            console.log(
              `[Consciousness Research - Embeddings] ✅ Successfully created Embedding node for consciousness node ID ${nodeId}.`
            );
            nodesUpdated++;
          } else {
            console.warn(
              `[Consciousness Research - Embeddings] ⚠️ Generated empty embedding for node ID ${nodeId}. Skipping update.`
            );
          }
        } catch (error) {
          console.error(
            `[Consciousness Research - Embeddings] ❌ Error processing node ID ${nodeId}:`,
            error
          );
          // Continue with next node to maintain research continuity
        }
        nodesProcessed++;
      }
      currentSkip += nodesToProcess.length;
    }

    console.log("[Consciousness Research - Embeddings] 🎉 Embedding generation complete!");
    console.log(
      `[Consciousness Research - Embeddings] 📊 Total nodes processed: ${nodesProcessed}`
    );
    console.log(
      `[Consciousness Research - Embeddings] ✅ Total nodes updated with embeddings: ${nodesUpdated}`
    );
    console.log(
      `[Consciousness Research - Embeddings] 🧠 Consciousness research knowledge now has enhanced semantic search capabilities!`
    );
  } catch (error) {
    console.error("[Consciousness Research - Embeddings] ❌ Critical error occurred:", error);
    throw error;
  } finally {
    await neo4jService.close();
    console.log("[Consciousness Research - Embeddings] 🔌 Neo4j connection closed.");
  }
}

// Script execution when run directly
 // import { fileURLToPath } from "url";

if (import.meta.url === `file://${process.argv[1]}`) {
  populateEmbeddings().catch((error: unknown) => {
    console.error(
      "[Consciousness Research - Embeddings] 💥 Unhandled error in script execution:",
      error
    );
    process.exit(1);
  });
}
