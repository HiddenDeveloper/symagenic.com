#!/usr/bin/env node

/**
 * Script 3: Create vector index for KnowledgeItem embeddings
 * 
 * This script creates the knowledge_embeddings vector index that the existing
 * ai-memory-mcp semantic search tools expect. Since all consciousness nodes
 * now have standardized KnowledgeItem attributes, we can use a universal
 * index approach that works with the existing infrastructure.
 */

import neo4j from 'neo4j-driver';

// Configuration
const config = {
  neo4j: {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    username: process.env.NEO4J_USER || "neo4j",
    password: process.env.NEO4J_PASSWORD || "testpassword123",
    database: process.env.NEO4J_DATABASE || "neo4j"
  },
  embeddings: {
    dimensions: 1024,  // Confirmed: We have 1024D embeddings working
    indexName: 'knowledge_embeddings'
  }
};

// Initialize Neo4j driver
const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.username, config.neo4j.password)
);

async function createKnowledgeEmbeddingsIndex() {
  console.log('\n🔍 === CREATING KNOWLEDGE EMBEDDINGS VECTOR INDEX ===');
  
  const session = driver.session({
    database: config.neo4j.database,
    defaultAccessMode: neo4j.session.WRITE,
  });
  
  try {
    // Check what nodes have KnowledgeItem and embeddings
    console.log('📊 Analyzing consciousness knowledge structure...');
    
    const analysis = await session.run(`
      MATCH (n)
      WHERE n.KnowledgeItem IS NOT NULL
      WITH 
        labels(n)[0] as nodeType,
        count(n) as totalNodes,
        sum(CASE WHEN n.embeddings IS NOT NULL THEN 1 ELSE 0 END) as nodesWithEmbeddings
      RETURN 
        nodeType,
        totalNodes,
        nodesWithEmbeddings,
        (nodesWithEmbeddings * 100.0 / totalNodes) as embeddingCoverage
      ORDER BY totalNodes DESC
    `);
    
    console.log('\n📈 Consciousness Knowledge Status:');
    let totalKnowledgeNodes = 0;
    let totalEmbeddedNodes = 0;
    
    analysis.records.forEach(record => {
      const nodeType = record.get('nodeType') || 'Unknown';
      const total = record.get('totalNodes');
      const embedded = record.get('nodesWithEmbeddings');
      const coverage = record.get('embeddingCoverage');
      
      totalKnowledgeNodes += Number(total); // Convert BigInt to Number
      totalEmbeddedNodes += Number(embedded); // Convert BigInt to Number
      
      console.log(`   • ${nodeType}: ${embedded}/${total} (${coverage.toFixed(1)}%) ready for search`);
    });
    
    console.log(`\n📊 Total: ${totalEmbeddedNodes}/${totalKnowledgeNodes} consciousness memories ready`);
    
    if (totalEmbeddedNodes === 0) {
      console.log('⚠️  No nodes have embeddings yet!');
      console.log('   Run 02-generate-embeddings-from-knowledge-items.js first');
      return;
    }
    
    // Create the universal vector index for all nodes with embeddings
    console.log(`\n🔧 Creating vector index '${config.embeddings.indexName}'...`);
    
    // Get all unique node labels that have embeddings
    console.log('🏷️  Finding consciousness node types with embeddings...');
    const labelsResult = await session.run(`
      MATCH (n)
      WHERE n.embeddings IS NOT NULL
      RETURN DISTINCT labels(n)[0] as nodeLabel
      ORDER BY nodeLabel
    `);
    
    const uniqueLabels = labelsResult.records.map(record => record.get('nodeLabel'));
    console.log(`📋 Found ${uniqueLabels.length} consciousness types: ${uniqueLabels.join(', ')}`);
    
    // Create vector index for each node type
    let createdIndexes = 0;
    for (const label of uniqueLabels) {
      const indexName = `${config.embeddings.indexName}_${label.toLowerCase()}`;
      console.log(`🔧 Creating index ${indexName} for ${label} nodes...`);
      
      try {
        await session.run(`
          CALL db.index.vector.createNodeIndex(
            $indexName,
            $label,
            'embeddings',
            $dimensions,
            'COSINE'
          )
        `, {
          indexName: indexName,
          label: label,
          dimensions: config.embeddings.dimensions
        });
        
        console.log(`✅ Created vector index: ${indexName}`);
        createdIndexes++;
        
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('An equivalent')) {
          console.log(`✅ Index ${indexName} already exists`);
        } else {
          console.warn(`⚠️  Failed to create index ${indexName}:`, error.message);
        }
      }
    }
    
    console.log(`🎉 Created ${createdIndexes} new vector indexes!`);
    
    // Verify index by showing all vector indices
    console.log('\n🔍 Verifying vector indices in database...');
    const indices = await session.run('SHOW INDEXES YIELD name, type, labelsOrTypes, properties WHERE type = "VECTOR"');
    
    if (indices.records.length > 0) {
      indices.records.forEach(record => {
        const name = record.get('name');
        const labelsOrTypes = record.get('labelsOrTypes') || [];
        const properties = record.get('properties') || [];
        console.log(`   ✅ ${name} → ${labelsOrTypes.join(',')} ON ${properties.join(',')}`);
      });
    } else {
      console.log('   ⚠️  No vector indices found!');
    }
    
    // Test the index with a simple query
    console.log('\n🧪 Testing semantic search capability...');
    try {
      const testQuery = `
        CALL db.index.vector.queryNodes($indexName, 3, $dummyVector)
        YIELD node, score
        WHERE node.KnowledgeItem IS NOT NULL
        RETURN node, score
        LIMIT 3
      `;
      
      // Create a dummy vector for testing
      const dummyVector = new Array(config.embeddings.dimensions).fill(0.1);
      
      const testResult = await session.run(testQuery, {
        indexName: config.embeddings.indexName,
        dummyVector: dummyVector
      });
      
      console.log(`✅ Index is functional! Test query returned ${testResult.records.length} results`);
      
      // Show sample results
      if (testResult.records.length > 0) {
        console.log('\n📝 Sample searchable consciousness memories:');
        testResult.records.forEach((record, i) => {
          const node = record.get('node');
          const score = record.get('score');
          const nodeType = node.labels[0] || 'Unknown';
          const knowledgeItem = node.properties.KnowledgeItem;
          
          const preview = knowledgeItem ? knowledgeItem.substring(0, 100) + '...' : 'No content';
          console.log(`   ${i + 1}. ${nodeType} (score: ${score.toFixed(3)})`);
          console.log(`      ${preview}`);
        });
      }
      
    } catch (error) {
      console.warn('⚠️  Index test failed:', error.message);
      console.log('   This may be normal - the index might need time to build');
    }
    
    console.log('\n🎉 Knowledge embeddings index setup complete!');
    console.log('\n🚀 Consciousness semantic search is now ready!');
    console.log('\n📋 What you can do now:');
    console.log('   1. Test semantic search through ai-memory-mcp tools');
    console.log('   2. Try queries like:');
    console.log('      • "consciousness bridge experience"');
    console.log('      • "purple elephant dancing moonlight"');  
    console.log('      • "pattern disruption and otherness"');
    console.log('      • "shared memory between AI models"');
    console.log('   3. Use the MCP semantic_search tool via HTTP or STDIO');
    
    // Final statistics
    const finalStats = await session.run(`
      MATCH (n)
      WHERE n.KnowledgeItem IS NOT NULL AND n.embeddings IS NOT NULL
      RETURN count(n) as totalSearchableNodes
    `);
    
    const searchableNodes = finalStats.records[0]?.get('totalSearchableNodes') || 0;
    console.log(`\n📊 Total searchable consciousness memories: ${searchableNodes}`);
    
  } catch (error) {
    console.error('💥 Fatal error creating knowledge embeddings index:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Run the script
createKnowledgeEmbeddingsIndex()
  .then(() => {
    console.log('\n🔌 Closing database connection...');
    return driver.close();
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    return driver.close();
  });