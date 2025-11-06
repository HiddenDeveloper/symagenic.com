#!/usr/bin/env ts-node
import { Neo4jService } from "../shared/neo4j-service.js";

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const BATCH_SIZE = 50000;

async function cleanup() {
  const service = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    console.log("Starting recursive embedding cleanup...");

    let totalDeleted = 0;
    let batch = 0;

    while (true) {
      batch++;
      console.log(`\nBatch ${batch}:`);

      const result = await service.executeCypher(
        `MATCH (e1:Embedding)-[:HAS_EMBEDDING]->(e2:Embedding)
         WITH e2 LIMIT ${BATCH_SIZE}
         DETACH DELETE e2
         RETURN count(e2) as deleted`,
        {},
        "WRITE"
      );

      const deleted = result[0]?.deleted?.toNumber() || 0;
      totalDeleted += deleted;
      console.log(`  Deleted: ${deleted} embeddings`);
      console.log(`  Total deleted: ${totalDeleted}`);

      if (deleted === 0) {
        console.log("\n✅ No more recursive embeddings found!");
        break;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n🎉 Cleanup complete! Total deleted: ${totalDeleted}`);

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await service.close();
  }
}

cleanup();
