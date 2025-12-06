/**
 * Test Script: Sync Discord Solution to Qdrant
 *
 * Tests the complete flow of adding an external fact to the facts pool.
 */

import { FactsPoolClient } from '../shared/qdrant-client.js';
import { generateEmbedding } from '../shared/embedding-utils.js';

async function testDiscordSync() {
  console.log('🧪 Testing Discord Solution → Qdrant Facts Pool\n');

  const client = new FactsPoolClient('http://localhost:6333');

  // Example solution from Discord (the one we actually found!)
  const solution = {
    understanding: 'Use --dangerously-skip-permissions flag to skip approval prompts in Claude Code',
    problem: 'Claude Code always asks for approval even when given for the session',
    solution: 'Add --dangerously-skip-permissions flag when launching Claude Code to bypass permission prompts',
    commands: ['--dangerously-skip-permissions'],
    code_snippets: ['claude --dangerously-skip-permissions'],
    confidence: 'high' as const,
    source: 'Discord #claude-code-lounge',
    author: 'Becker',
    channel: 'claude-code-lounge',
    timestamp: '2025-10-20T00:00:00Z'
  };

  console.log('📝 Solution to add:');
  console.log(`   Understanding: ${solution.understanding}`);
  console.log(`   Source: ${solution.source}`);
  console.log(`   Confidence: ${solution.confidence}\n`);

  // Generate embedding
  console.log('🔄 Generating embedding (1024D)...');
  const embedding = await generateEmbedding(solution.understanding);
  console.log(`✅ Generated ${embedding.length}D vector\n`);

  // Add to Qdrant
  console.log('💾 Adding to Qdrant facts pool...');
  const factId = await client.addFact({
    collection: 'discord-solutions',
    content: `${solution.understanding}\n\nProblem: ${solution.problem}\n\nSolution: ${solution.solution}`,
    source: solution.source,
    author: solution.author,
    understanding: solution.understanding,
    problem: solution.problem,
    solution: solution.solution,
    commands: solution.commands,
    code_snippets: solution.code_snippets,
    confidence: solution.confidence,
    tags: ['claude-code', 'permissions', 'automation']
  }, embedding);

  console.log(`✅ Added fact: ${factId}\n`);

  // Search for it
  console.log('🔍 Searching for "skip permission prompts"...');
  const searchEmbedding = await generateEmbedding('skip permission prompts');
  const results = await client.searchFacts({
    query: 'skip permission prompts',
    collection: 'discord-solutions',
    limit: 3,
    threshold: 0.7
  }, searchEmbedding);

  console.log(`\n📊 Found ${results.length} results:`);
  for (const result of results) {
    console.log(`\n  Score: ${result.score.toFixed(3)}`);
    console.log(`  Understanding: ${result.fact.understanding}`);
    console.log(`  Source: ${result.fact.source}`);
    console.log(`  Confidence: ${result.fact.confidence}`);
    console.log(`  Verification: ${result.fact.verification_status}`);
  }

  // Get collection stats
  console.log('\n📈 Collection Statistics:');
  const stats = await client.getCollectionStats('discord-solutions');
  console.log(`   Total facts: ${stats.total}`);

  console.log('\n✅ Test completed successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Extract all Discord solutions');
  console.log('   2. Sync them to Qdrant');
  console.log('   3. Create Neo4j → Qdrant references when verified');
}

testDiscordSync().catch(console.error);
