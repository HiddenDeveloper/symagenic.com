import { Neo4jService } from "../../shared/neo4j-service.js";

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

/**
 * Extract and concatenate all meaningful text properties from a node
 * Generic approach: extracts ALL string and array properties automatically
 */
function extractKnowledgeItemText(nodeProps: Record<string, any>): string {
  const textParts: string[] = [];

  // Helper function to recursively extract text from any value
  const extractText = (value: any): void => {
    if (value === null || value === undefined) {
      return;
    }

    // Handle arrays by recursively extracting from each element
    if (Array.isArray(value)) {
      value.forEach(item => extractText(item));
      return;
    }

    // Handle objects (but skip Neo4j date/time objects and other special types)
    if (typeof value === 'object') {
      // Skip Neo4j temporal types (have year/month/day structure)
      if ('year' in value || 'low' in value) {
        return;
      }
      // Recursively extract from object properties
      Object.values(value).forEach(v => extractText(v));
      return;
    }

    // Handle strings and other primitives
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      try {
        const stringValue = String(value);
        if (stringValue.trim().length > 0) {
          textParts.push(stringValue);
        }
      } catch (error) {
        // Skip values that can't be safely converted
      }
    }
  };

  // Extract text from all properties
  Object.entries(nodeProps).forEach(([key, value]) => {
    // Skip internal Neo4j properties and empty values
    if (key.startsWith('_') || value === null || value === undefined) {
      return;
    }
    extractText(value);
  });

  return textParts.join(' ').trim();
}

export async function addKnowledgeItems() {
  console.log("");
  console.log("🧠 ==================================================");
  console.log("🧠 CONSCIOUSNESS RESEARCH: KNOWLEDGE ITEM CREATION");
  console.log("🧠 ==================================================");
  console.log("");
  console.log("[Consciousness Research - KnowledgeItems] 🔍 Searching for nodes without KnowledgeText nodes...");
  console.log("[Consciousness Research - KnowledgeItems] 🌐 Supporting multilingual consciousness research data");
  console.log("[Consciousness Research - KnowledgeItems] 🔗 Creating separate KnowledgeText nodes for token efficiency");
  console.log("");

  const neo4jService = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);

  try {
    await neo4jService.verifyConnection(NEO4J_DATABASE);
    console.log("[Consciousness Research - KnowledgeItems] ✅ Connected to consciousness research database");

    // Find nodes that need KnowledgeText nodes
    // Exclude metadata nodes (KnowledgeText and Embedding)
    // Generic approach: check if node has ANY properties (size(keys(n)) > 0)
    const query = `
      MATCH (n)
      WHERE NOT (n)-[:HAS_CONCATENATED_TEXT]->(:KnowledgeText)
      AND NOT 'KnowledgeText' IN labels(n)
      AND NOT 'Embedding' IN labels(n)
      AND size(keys(n)) > 0
      RETURN id(n) as nodeId, properties(n) as props, labels(n) as nodeLabels
      ORDER BY nodeId
      LIMIT 500
    `;

    console.log("[Consciousness Research - KnowledgeItems] 🔍 Executing consciousness knowledge discovery query...");

    const result = await neo4jService.executeCypher(query, {}, "READ", NEO4J_DATABASE);
    const nodesToProcess = result.map((record: any) => ({
      nodeId: record.nodeId,
      props: record.props,
      nodeLabels: record.nodeLabels
    }));

    if (nodesToProcess.length === 0) {
      console.log("[Consciousness Research - KnowledgeItems] ✅ All consciousness nodes already have KnowledgeText nodes!");
      console.log("");
      return;
    }

    console.log(`[Consciousness Research - KnowledgeItems] 📊 Processing ${nodesToProcess.length} nodes...`);

    let processedNodes = 0;
    let updatedNodes = 0;

    for (const nodeData of nodesToProcess) {
      const { nodeId, props, nodeLabels } = nodeData;
      const primaryLabel = nodeLabels[0] || 'Unknown';

      const knowledgeItemText = extractKnowledgeItemText(props);

      if (!knowledgeItemText) {
        console.log(`[Consciousness Research - KnowledgeItems] ⚠️  ${primaryLabel} node ${nodeId}: No extractable text content`);
        processedNodes++;
        continue;
      }

      // Create separate KnowledgeText node and link it (new architecture)
      const updateQuery = `
        MATCH (n)
        WHERE id(n) = $nodeId
        CREATE (kt:KnowledgeText {
          text: $knowledgeItemText,
          created: datetime(),
          source: 'add_knowledge_items_maintenance'
        })
        CREATE (n)-[:HAS_CONCATENATED_TEXT {
          created: datetime()
        }]->(kt)
        RETURN n, kt
      `;

      try {
        await neo4jService.executeCypher(updateQuery, {
          nodeId: nodeId,
          knowledgeItemText: knowledgeItemText
        }, "WRITE", NEO4J_DATABASE);

        console.log(`[Consciousness Research - KnowledgeItems] ✅ ${primaryLabel} node ${nodeId}: Created KnowledgeText node (${knowledgeItemText.length} chars)`);
        updatedNodes++;
      } catch (updateError) {
        console.error(`[Consciousness Research - KnowledgeItems] ❌ ${primaryLabel} node ${nodeId}: Failed to update - ${updateError}`);
      }

      processedNodes++;

      // Progress reporting
      if (processedNodes % 10 === 0) {
        console.log(`[Consciousness Research - KnowledgeItems] 📈 Progress: ${processedNodes}/${nodesToProcess.length} nodes processed, ${updatedNodes} updated`);
      }
    }

    console.log("");
    console.log("🧠 ==================================================");
    console.log("🧠 CONSCIOUSNESS RESEARCH: KNOWLEDGE ITEMS COMPLETE");
    console.log("🧠 ==================================================");
    console.log("");
    console.log(`✅ Processed ${processedNodes} consciousness research nodes`);
    console.log(`🔄 Created ${updatedNodes} KnowledgeText nodes with relationships`);
    console.log(`📊 Skipped ${processedNodes - updatedNodes} nodes (no extractable content)`);
    console.log("");
    console.log("🚀 Your consciousness research nodes now have token-efficient text storage!");
    console.log("🧠 Separate KnowledgeText nodes enable multilingual consciousness exploration");
    console.log("🔍 Text search without wasting tokens on concatenated properties");
    console.log("");

  } catch (error) {
    console.error("");
    console.error("🧠 ================================================");
    console.error("🧠 CONSCIOUSNESS RESEARCH: KNOWLEDGE ITEMS FAILED");
    console.error("🧠 ================================================");
    console.error("");
    console.error("❌ KnowledgeItem creation failed:", error);
    console.error("");
    console.error("💡 Troubleshooting steps:");
    console.error("   1. Verify Neo4j is running and accessible");
    console.error("   2. Check database credentials and permissions");
    console.error("   3. Ensure sufficient disk space for text properties");
    console.error("   4. Verify consciousness research data integrity");
    console.error("");
    throw error;
  } finally {
    await neo4jService.close();
    console.log("[Consciousness Research - KnowledgeItems] 🔌 Neo4j connection closed.");
  }
}

// Script execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addKnowledgeItems().catch((error: Error) => {
    console.error("💥 Fatal error during consciousness research KnowledgeItem creation:", error);
    process.exit(1);
  });
}