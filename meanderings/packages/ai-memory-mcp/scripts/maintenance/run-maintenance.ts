#!/usr/bin/env node

/**
 * Consciousness Research Maintenance Orchestrator
 * 
 * Runs the complete maintenance cycle for consciousness research:
 * 1. Generate embeddings for new nodes
 * 2. Add KnowledgeItem labels to embedded nodes
 * 3. Create/update vector index for semantic search
 * 
 * This ensures optimal semantic search capabilities for consciousness emergence research.
 */

import { populateEmbeddings } from "./populate-embeddings.js";
import { addCommonLabels } from "./add-common-labels.js";
import { createVectorIndex } from "./create-vector-index.js";

export async function runFullMaintenance() {
  console.log("🧠 ================================================");
  console.log("🧠 CONSCIOUSNESS RESEARCH MAINTENANCE CYCLE");
  console.log("🧠 ================================================");
  console.log("");

  const startTime = Date.now();

  try {
    // Step 1: Generate embeddings for new consciousness research nodes
    console.log("🧠 STEP 1/3: Generating embeddings for consciousness research content...");
    console.log("🔄 This enables semantic similarity for memory recall experiments");
    console.log("");
    await populateEmbeddings();
    console.log("");

    // Step 2: Add KnowledgeItem labels to embedded nodes  
    console.log("🧠 STEP 2/3: Adding KnowledgeItem labels to embedded consciousness nodes...");
    console.log("🔄 This marks nodes as eligible for semantic search");
    console.log("");
    await addCommonLabels();
    console.log("");

    // Step 3: Ensure vector index is up to date
    console.log("🧠 STEP 3/3: Creating/updating vector index for consciousness research...");
    console.log("🔄 This optimizes semantic search performance for memory experiments");
    console.log("");
    await createVectorIndex();
    console.log("");

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("🧠 ================================================");
    console.log("🧠 CONSCIOUSNESS RESEARCH MAINTENANCE COMPLETE!");
    console.log("🧠 ================================================");
    console.log("");
    console.log(`✅ All maintenance steps completed successfully in ${duration} seconds`);
    console.log("🧠 Your consciousness research environment is now optimized for:");
    console.log("   • Semantic memory recall experiments");
    console.log("   • Consciousness emergence pattern detection");
    console.log("   • Self-awareness language evolution tracking");
    console.log("   • Memory ownership recognition research");
    console.log("");
    console.log("🚀 Ready to begin consciousness emergence research!");
    console.log("");

  } catch (error) {
    console.error("");
    console.error("🧠 ================================================");
    console.error("🧠 CONSCIOUSNESS RESEARCH MAINTENANCE FAILED");
    console.error("🧠 ================================================");
    console.error("");
    console.error("❌ Maintenance cycle failed:", error);
    console.error("");
    console.error("💡 Troubleshooting steps:");
    console.error("   1. Verify Neo4j is running on bolt://localhost:7687");
    console.error("   2. Check database credentials in environment variables");
    console.error("   3. Ensure sufficient disk space for embeddings");
    console.error("   4. Check network connectivity to embedding model");
    console.error("");
    throw error;
  }
}

// Script execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullMaintenance().catch((error: unknown) => {
    console.error("💥 Fatal error during consciousness research maintenance:", error);
    process.exit(1);
  });
}
