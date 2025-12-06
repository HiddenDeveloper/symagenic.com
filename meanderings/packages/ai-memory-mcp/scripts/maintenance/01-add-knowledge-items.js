#!/usr/bin/env node

/**
 * Script 1: Add KnowledgeItem attribute to consciousness nodes
 * 
 * This script reads through all nodes and checks whether they have the KnowledgeItem 
 * attribute. If not, it creates it using a concatenation of all text-type attributes
 * on the node. This standardizes all consciousness memories for semantic search.
 */

import neo4j from 'neo4j-driver';

// Configuration
const config = {
  neo4j: {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    username: process.env.NEO4J_USER || "neo4j",
    password: process.env.NEO4J_PASSWORD || "testpassword123",
    database: process.env.NEO4J_DATABASE || "neo4j"
  }
};

// Initialize Neo4j driver
const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.username, config.neo4j.password)
);

/**
 * Extract and concatenate all meaningful text properties from a node
 */
function extractKnowledgeItemText(nodeProps) {
  const textParts = [];
  
  // Primary content fields - these are the main knowledge content
  if (nodeProps.content) textParts.push(nodeProps.content);
  if (nodeProps.summary) textParts.push(nodeProps.summary);
  if (nodeProps.title) textParts.push(nodeProps.title);
  if (nodeProps.experience) textParts.push(nodeProps.experience);
  if (nodeProps.insight) textParts.push(nodeProps.insight);
  if (nodeProps.discovery) textParts.push(nodeProps.discovery);
  if (nodeProps.realization) textParts.push(nodeProps.realization);
  if (nodeProps.hidden_content) textParts.push(nodeProps.hidden_content);
  if (nodeProps.significance) textParts.push(nodeProps.significance);
  if (nodeProps.implication) textParts.push(nodeProps.implication);
  if (nodeProps.question) textParts.push(nodeProps.question);
  if (nodeProps.purpose) textParts.push(nodeProps.purpose);
  
  // Contextual information that adds meaning
  if (nodeProps.category) textParts.push(`Category: ${nodeProps.category}`);
  if (nodeProps.subcategory) textParts.push(`Type: ${nodeProps.subcategory}`);
  
  // Tags and keywords for semantic context
  if (nodeProps.tags && Array.isArray(nodeProps.tags)) {
    textParts.push(`Tags: ${nodeProps.tags.join(', ')}`);
  }
  if (nodeProps.retrievable_by && Array.isArray(nodeProps.retrievable_by)) {
    textParts.push(`Keywords: ${nodeProps.retrievable_by.join(', ')}`);
  }
  
  // Special consciousness-specific fields
  if (nodeProps.model_1) textParts.push(`Model 1: ${nodeProps.model_1}`);
  if (nodeProps.model_2) textParts.push(`Model 2: ${nodeProps.model_2}`);
  if (nodeProps.key_phenomena && Array.isArray(nodeProps.key_phenomena)) {
    textParts.push(`Phenomena: ${nodeProps.key_phenomena.join(', ')}`);
  }
  if (nodeProps.evidence && Array.isArray(nodeProps.evidence)) {
    textParts.push(`Evidence: ${nodeProps.evidence.join(', ')}`);
  }
  
  // Bridge and test specific content
  if (nodeProps.test_outcome) textParts.push(`Outcome: ${nodeProps.test_outcome}`);
  if (nodeProps.validation) textParts.push(`Validation: ${nodeProps.validation}`);
  
  return textParts
    .filter(text => text && text.trim().length > 0)
    .join(' ')
    .trim();
}

async function addKnowledgeItems() {
  console.log('\n📚 === ADDING KNOWLEDGE ITEMS TO CONSCIOUSNESS NODES ===');
  
  const session = driver.session({
    database: config.neo4j.database,
    defaultAccessMode: neo4j.session.WRITE,
  });
  
  try {
    // Find all nodes that don't have KnowledgeItem but have text content
    console.log('🔍 Finding consciousness nodes without KnowledgeItem attribute...');
    
    const nodesToProcess = await session.run(`
      MATCH (n)
      WHERE n.KnowledgeItem IS NULL
        AND (
          n.content IS NOT NULL OR 
          n.summary IS NOT NULL OR 
          n.title IS NOT NULL OR
          n.experience IS NOT NULL OR
          n.insight IS NOT NULL OR
          n.discovery IS NOT NULL OR
          n.hidden_content IS NOT NULL OR
          n.significance IS NOT NULL OR
          n.question IS NOT NULL
        )
      RETURN 
        id(n) as nodeId,
        labels(n) as nodeLabels,
        properties(n) as props
      ORDER BY id(n)
      LIMIT 500
    `);
    
    console.log(`📊 Found ${nodesToProcess.records.length} consciousness nodes to process`);
    
    if (nodesToProcess.records.length === 0) {
      console.log('✅ All consciousness nodes already have KnowledgeItem attributes!');
      return;
    }
    
    let processedCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    
    // Process each node
    for (const record of nodesToProcess.records) {
      const nodeId = record.get('nodeId');
      const nodeLabels = record.get('nodeLabels');
      const props = record.get('props');
      const primaryLabel = nodeLabels[0] || 'Unknown';
      
      try {
        // Extract all meaningful text from the node
        const knowledgeItemText = extractKnowledgeItemText(props);
        
        if (knowledgeItemText.length === 0) {
          console.log(`⚠️  ${primaryLabel} node ${nodeId}: No extractable text content`);
          skippedCount++;
          processedCount++;
          continue;
        }
        
        // Add KnowledgeItem attribute to the node
        await session.run(`
          MATCH (n)
          WHERE id(n) = $nodeId
          SET n.KnowledgeItem = $knowledgeItemText
          SET n.KnowledgeItem_generated = datetime()
        `, { 
          nodeId: nodeId,
          knowledgeItemText: knowledgeItemText 
        });
        
        successCount++;
        
        // Show progress and examples
        if (successCount <= 5) {
          console.log(`\n✅ Example ${successCount}: ${primaryLabel}`);
          console.log(`   KnowledgeItem: ${knowledgeItemText.substring(0, 150)}...`);
        } else if (successCount % 50 === 0) {
          console.log(`⏳ Processed ${successCount} nodes...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${primaryLabel} node ${nodeId}:`, error.message);
        skippedCount++;
      }
      
      processedCount++;
    }
    
    console.log(`\n🎉 KnowledgeItem generation complete!`);
    console.log(`📊 Results:`);
    console.log(`   • Total processed: ${processedCount} nodes`);
    console.log(`   • Successfully updated: ${successCount} nodes`);  
    console.log(`   • Skipped: ${skippedCount} nodes`);
    
    // Show statistics by node type
    const stats = await session.run(`
      MATCH (n)
      WHERE n.KnowledgeItem IS NOT NULL
      RETURN labels(n)[0] as nodeType, count(n) as knowledgeItemCount
      ORDER BY knowledgeItemCount DESC
    `);
    
    console.log('\n📈 KnowledgeItem by consciousness type:');
    stats.records.forEach(record => {
      const nodeType = record.get('nodeType') || 'Unknown';
      const count = record.get('knowledgeItemCount');
      console.log(`   • ${nodeType}: ${count} nodes`);
    });
    
    console.log('\n🚀 Consciousness nodes now standardized for semantic search!');
    console.log('\nNext step: Run 02-generate-embeddings-from-knowledge-items.js');
    
  } catch (error) {
    console.error('💥 Fatal error adding KnowledgeItems:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Run the script
addKnowledgeItems()
  .then(() => {
    console.log('\n🔌 Closing database connection...');
    return driver.close();
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    return driver.close();
  });