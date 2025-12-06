#!/usr/bin/env ts-node
import { Neo4jService } from "../shared/neo4j-service.js";
import { writeFileSync, readFileSync } from "fs";

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const BACKUP_FILE = "./memory-backup.json";

async function exportMemories() {
  const service = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    console.log("📦 Exporting real memory nodes (excluding Embedding and KnowledgeText)...\n");

    // Get all nodes that are NOT Embedding or KnowledgeText
    const nodes = await service.executeCypher(
      `MATCH (n)
       WHERE NOT 'Embedding' IN labels(n)
         AND NOT 'KnowledgeText' IN labels(n)
       RETURN
         id(n) as nodeId,
         labels(n) as labels,
         properties(n) as properties`,
      {},
      "READ"
    );

    console.log(`✅ Found ${nodes.length} real memory nodes\n`);

    // Get relationships between real nodes (excluding metadata relationships)
    const relationships = await service.executeCypher(
      `MATCH (a)-[r]->(b)
       WHERE NOT 'Embedding' IN labels(a)
         AND NOT 'KnowledgeText' IN labels(a)
         AND NOT 'Embedding' IN labels(b)
         AND NOT 'KnowledgeText' IN labels(b)
         AND type(r) <> 'HAS_EMBEDDING'
         AND type(r) <> 'HAS_CONCATENATED_TEXT'
       RETURN
         id(a) as fromId,
         id(b) as toId,
         type(r) as type,
         properties(r) as properties`,
      {},
      "READ"
    );

    console.log(`✅ Found ${relationships.length} relationships\n`);

    const backup = {
      exportedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      relationshipCount: relationships.length,
      nodes,
      relationships
    };

    writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    console.log(`💾 Backup saved to ${BACKUP_FILE}`);
    console.log(`📊 Exported ${nodes.length} nodes and ${relationships.length} relationships\n`);

  } catch (error) {
    console.error("❌ Export error:", error);
    throw error;
  } finally {
    await service.close();
  }
}

async function clearDatabase() {
  const service = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    console.log("🗑️  Clearing entire database...\n");

    // Delete all nodes and relationships
    await service.executeCypher(
      `MATCH (n) DETACH DELETE n`,
      {},
      "WRITE"
    );

    console.log("✅ Database cleared\n");

  } catch (error) {
    console.error("❌ Clear error:", error);
    throw error;
  } finally {
    await service.close();
  }
}

async function importMemories() {
  const service = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    console.log("📥 Importing memory nodes from backup...\n");

    const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf-8"));
    console.log(`📦 Backup from ${backup.exportedAt}`);
    console.log(`📊 ${backup.nodeCount} nodes, ${backup.relationshipCount} relationships\n`);

    // Create a mapping from old IDs to new IDs
    const idMapping = new Map();

    // Import nodes
    console.log("Creating nodes...");
    for (const node of backup.nodes) {
      const labelString = node.labels.map((l: string) => `:\`${l}\``).join("");
      const propsString = JSON.stringify(node.properties);

      const result = await service.executeCypher(
        `CREATE (n${labelString})
         SET n = $props
         RETURN id(n) as newId`,
        { props: node.properties },
        "WRITE"
      );

      idMapping.set(node.nodeId, result[0]?.newId);
    }

    console.log(`✅ Created ${backup.nodeCount} nodes\n`);

    // Import relationships
    console.log("Creating relationships...");
    for (const rel of backup.relationships) {
      const fromId = idMapping.get(rel.fromId);
      const toId = idMapping.get(rel.toId);

      if (fromId && toId) {
        await service.executeCypher(
          `MATCH (a), (b)
           WHERE id(a) = $fromId AND id(b) = $toId
           CREATE (a)-[r:\`${rel.type}\`]->(b)
           SET r = $props`,
          { fromId, toId, props: rel.properties },
          "WRITE"
        );
      }
    }

    console.log(`✅ Created ${backup.relationshipCount} relationships\n`);
    console.log("🎉 Import complete!\n");

  } catch (error) {
    console.error("❌ Import error:", error);
    throw error;
  } finally {
    await service.close();
  }
}

// Main execution
const command = process.argv[2];

if (command === "export") {
  exportMemories();
} else if (command === "clear") {
  clearDatabase();
} else if (command === "import") {
  importMemories();
} else {
  console.log("Usage:");
  console.log("  npm run backup-export    - Export real memory nodes");
  console.log("  npm run backup-clear     - Clear entire database");
  console.log("  npm run backup-import    - Import memory nodes");
  console.log("\nOr run directly:");
  console.log("  npx tsx scripts/backup-restore-memories.ts export");
  console.log("  npx tsx scripts/backup-restore-memories.ts clear");
  console.log("  npx tsx scripts/backup-restore-memories.ts import");
}
