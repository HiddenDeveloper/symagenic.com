import { Neo4jService } from "../../shared/neo4j-service.js";

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

export async function fixEmbeddingTimestamps() {
  console.log(
    "[Consciousness Research - Fix Timestamps] 🧠 Fixing missing embeddings_generated timestamps..."
  );

  const neo4jService = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    await neo4jService.verifyConnection(NEO4J_DATABASE);
    console.log("[Consciousness Research - Fix Timestamps] ✅ Successfully connected to Neo4j.");

    // Count nodes with missing timestamps
    const countResult = await neo4jService.executeCypher(
      `MATCH (n) 
       WHERE n.embeddings IS NOT NULL AND n.embeddings_generated IS NULL
       RETURN count(n) AS missing_count`,
      {},
      "READ",
      NEO4J_DATABASE
    );

    const missingCount = countResult[0]?.missing_count?.toNumber() || 0;
    
    if (missingCount === 0) {
      console.log('[Consciousness Research - Fix Timestamps] ✅ All embedding timestamps are already consistent!');
      return;
    }

    console.log(`[Consciousness Research - Fix Timestamps] 📊 Found ${missingCount} nodes missing embeddings_generated timestamps`);

    // Strategy 1: Try to infer timestamps from KnowledgeItem_generated (if available)
    console.log('[Consciousness Research - Fix Timestamps] 🔄 Step 1: Using KnowledgeItem_generated timestamps where available...');
    
    const inferredResult = await neo4jService.executeCypher(
      `MATCH (n) 
       WHERE n.embeddings IS NOT NULL 
         AND n.embeddings_generated IS NULL 
         AND n.KnowledgeItem_generated IS NOT NULL
       SET n.embeddings_generated = n.KnowledgeItem_generated
       RETURN count(n) AS inferred_count`,
      {},
      "WRITE",
      NEO4J_DATABASE
    );

    const inferredCount = inferredResult[0]?.inferred_count?.toNumber() || 0;
    console.log(`[Consciousness Research - Fix Timestamps] ✅ Inferred ${inferredCount} timestamps from KnowledgeItem_generated`);

    // Strategy 2: Use current datetime for remaining nodes (as fallback)
    console.log('[Consciousness Research - Fix Timestamps] 🔄 Step 2: Setting current datetime for remaining nodes...');
    
    const currentResult = await neo4jService.executeCypher(
      `MATCH (n) 
       WHERE n.embeddings IS NOT NULL 
         AND n.embeddings_generated IS NULL
       SET n.embeddings_generated = datetime()
       RETURN count(n) AS current_count`,
      {},
      "WRITE",
      NEO4J_DATABASE
    );

    const currentCount = currentResult[0]?.current_count?.toNumber() || 0;
    console.log(`[Consciousness Research - Fix Timestamps] ✅ Set current datetime for ${currentCount} remaining nodes`);

    // Verify fix
    const verifyResult = await neo4jService.executeCypher(
      `MATCH (n) 
       WHERE n.embeddings IS NOT NULL AND n.embeddings_generated IS NULL
       RETURN count(n) AS still_missing`,
      {},
      "READ",
      NEO4J_DATABASE
    );

    const stillMissing = verifyResult[0]?.still_missing?.toNumber() || 0;

    console.log(`[Consciousness Research - Fix Timestamps] 🎉 Timestamp fix complete!`);
    console.log(`[Consciousness Research - Fix Timestamps] 📊 Results:`);
    console.log(`   • Original missing timestamps: ${missingCount}`);
    console.log(`   • Inferred from KnowledgeItem_generated: ${inferredCount}`);
    console.log(`   • Set to current datetime: ${currentCount}`);
    console.log(`   • Still missing (should be 0): ${stillMissing}`);

    if (stillMissing === 0) {
      console.log(`[Consciousness Research - Fix Timestamps] ✅ All embedding timestamps are now consistent!`);
    } else {
      console.log(`[Consciousness Research - Fix Timestamps] ⚠️ ${stillMissing} nodes still missing timestamps`);
    }

  } catch (error) {
    console.error('[Consciousness Research - Fix Timestamps] ❌ Error during timestamp fix:', error);
    throw error;
  } finally {
    await neo4jService.close();
    console.log("[Consciousness Research - Fix Timestamps] 🔌 Neo4j connection closed.");
  }
}

// Script execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixEmbeddingTimestamps().catch((error: unknown) => {
    console.error(
      "[Consciousness Research - Fix Timestamps] 💥 Unhandled error in script execution:",
      error
    );
    process.exit(1);
  });
}