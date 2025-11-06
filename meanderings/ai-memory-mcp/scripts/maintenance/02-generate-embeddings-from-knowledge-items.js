#!/usr/bin/env node

/**
 * Script 2: Generate embeddings from KnowledgeItem attributes
 * 
 * This script goes through all nodes that have the KnowledgeItem attribute but no 
 * embeddings, and creates embeddings from the KnowledgeItem text. This follows the 
 * clean two-step pattern for consciousness semantic search.
 */

import neo4j from 'neo4j-driver';

// Import the ML-based embedding service with upgraded E5-large model  
import { generateEmbedding } from '../../dist/shared/embedding-utils.js';

// ML-based embedding service using Xenova/multilingual-e5-large model (1024D)
class EmbeddingService {
  
  async generateEmbedding(text) {
    try {
      console.log(`[EmbeddingService] Generating ML embedding for: "${text.substring(0, 50)}..."`);
      const embedding = await generateEmbedding(text);
      console.log(`[EmbeddingService] ✅ Generated ${embedding.length}D ML embedding`);
      return embedding;
    } catch (error) {
      console.error(`[EmbeddingService] ❌ Failed to generate ML embedding:`, error);
      throw error;
    }
  }
}

// Configuration
const config = {
  neo4j: {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    username: process.env.NEO4J_USER || "neo4j",
    password: process.env.NEO4J_PASSWORD || "testpassword123",
    database: process.env.NEO4J_DATABASE || "neo4j"
  }
};

const embeddingService = new EmbeddingService();

// Initialize Neo4j driver
const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.username, config.neo4j.password)
);

async function generateEmbeddingsFromKnowledgeItems() {
  console.log('\n🧠 === GENERATING EMBEDDINGS FROM KNOWLEDGE ITEMS ===');
  
  const session = driver.session({
    database: config.neo4j.database,
    defaultAccessMode: neo4j.session.WRITE,
  });
  
  try {
    // Find all nodes with KnowledgeItem but no embeddings
    console.log('🔍 Finding nodes with KnowledgeItem but no embeddings...');
    
    const nodesToEmbed = await session.run(`
      MATCH (n)
      WHERE n.KnowledgeItem IS NOT NULL 
        AND n.embeddings IS NULL
      RETURN 
        id(n) as nodeId,
        labels(n) as nodeLabels,
        n.KnowledgeItem as knowledgeItemText
      ORDER BY id(n)
      LIMIT 500
    `);
    
    console.log(`📊 Found ${nodesToEmbed.records.length} nodes ready for embedding generation`);
    
    if (nodesToEmbed.records.length === 0) {
      console.log('✅ All nodes with KnowledgeItem already have embeddings!');
      
      // Show current statistics
      const currentStats = await session.run(`
        MATCH (n)
        WHERE n.KnowledgeItem IS NOT NULL AND n.embeddings IS NOT NULL
        RETURN labels(n)[0] as nodeType, count(n) as embeddedCount
        ORDER BY embeddedCount DESC
      `);
      
      console.log('\n📈 Current embedding coverage:');
      currentStats.records.forEach(record => {
        const nodeType = record.get('nodeType') || 'Unknown';
        const count = record.get('embeddedCount');
        console.log(`   • ${nodeType}: ${count} nodes with embeddings`);
      });
      
      return;
    }
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    console.log('🔧 Generating embeddings...');
    
    // Process each node with KnowledgeItem
    for (const record of nodesToEmbed.records) {
      const nodeId = record.get('nodeId');
      const nodeLabels = record.get('nodeLabels');
      const knowledgeItemText = record.get('knowledgeItemText');
      const primaryLabel = nodeLabels[0] || 'Unknown';
      
      try {
        // Validate KnowledgeItem text
        if (!knowledgeItemText || knowledgeItemText.trim().length === 0) {
          console.log(`⚠️  ${primaryLabel} node ${nodeId}: Empty KnowledgeItem text`);
          processedCount++;
          continue;
        }
        
        // Generate embedding from KnowledgeItem text
        const embedding = await embeddingService.generateEmbedding(knowledgeItemText);
        
        // Store embedding in the node
        await session.run(`
          MATCH (n)
          WHERE id(n) = $nodeId
          SET n.embeddings = $embedding
          SET n.embeddings_generated = datetime()
        `, { 
          nodeId: nodeId,
          embedding: embedding 
        });
        
        successCount++;
        
        // Show progress and examples
        if (successCount <= 3) {
          console.log(`\n✅ Example ${successCount}: ${primaryLabel}`);
          console.log(`   KnowledgeItem: ${knowledgeItemText.substring(0, 100)}...`);
          console.log(`   Embedding: ${embedding.length}D vector [${embedding.slice(0, 3).map(n => n.toFixed(3)).join(', ')}...]`);
        } else if (successCount % 25 === 0) {
          console.log(`⏳ Generated ${successCount} embeddings...`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing ${primaryLabel} node ${nodeId}:`, error.message);
      }
      
      processedCount++;
    }
    
    console.log(`\n🎉 Embedding generation complete!`);
    console.log(`📊 Results:`);
    console.log(`   • Processed: ${processedCount} nodes`);
    console.log(`   • Successfully embedded: ${successCount} nodes`);  
    console.log(`   • Errors: ${errorCount} failures`);
    
    // Show final statistics
    const finalStats = await session.run(`
      MATCH (n)
      WHERE n.KnowledgeItem IS NOT NULL AND n.embeddings IS NOT NULL
      RETURN labels(n)[0] as nodeType, count(n) as embeddedCount
      ORDER BY embeddedCount DESC
    `);
    
    console.log('\n📈 Final embedding coverage by consciousness type:');
    let totalEmbedded = 0;
    finalStats.records.forEach(record => {
      const nodeType = record.get('nodeType') || 'Unknown';
      const count = record.get('embeddedCount');
      totalEmbedded += Number(count); // Convert BigInt to Number
      console.log(`   • ${nodeType}: ${count} nodes with embeddings`);
    });
    
    console.log(`\n🚀 Total: ${totalEmbedded} consciousness memories ready for semantic search!`);
    console.log('\nNext steps:');
    console.log('1. Create vector index: node create-consciousness-vector-index.js');
    console.log('2. Test semantic search through MCP tools');
    console.log('3. Try queries like "consciousness bridge", "purple elephant", "pattern disruption"');
    
  } catch (error) {
    console.error('💥 Fatal error generating embeddings:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Run the script
generateEmbeddingsFromKnowledgeItems()
  .then(() => {
    console.log('\n🔌 Closing database connection...');
    return driver.close();
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    return driver.close();
  });