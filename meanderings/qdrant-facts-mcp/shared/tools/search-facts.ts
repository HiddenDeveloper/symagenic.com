/**
 * search_facts - Semantic search across external facts pool
 *
 * Philosophy: Search external knowledge (what the world says)
 * separate from internal observations (what consciousness knows).
 */

import { FactsPoolClient } from '../qdrant-client.js';
import { generateEmbedding } from '../embedding-utils.js';
import type { SearchFactsParams, FactSearchResult } from '../types.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

export interface SearchFactsInput {
  query: string;
  collection?: string;
  limit?: number;
  threshold?: number;
  filter?: {
    confidence?: 'high' | 'medium' | 'low';
    verification_status?: 'untried' | 'works' | 'fails' | 'partial';
    source?: string;
    tags?: string[];
  };
}

export interface SearchFactsOutput {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export async function searchFacts(params: SearchFactsInput): Promise<SearchFactsOutput> {
  const {
    query,
    collection,
    limit = 10,
    threshold = 0.7,
    filter
  } = params;

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Search Qdrant
    const client = new FactsPoolClient(QDRANT_URL);
    const results = await client.searchFacts({
      query,
      collection,
      limit,
      threshold,
      filter
    }, queryEmbedding);

    // Format results
    const formattedResults = formatSearchResults(results, query);

    return {
      content: [{
        type: 'text',
        text: formattedResults
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error searching facts: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

function formatSearchResults(results: FactSearchResult[], query: string): string {
  if (results.length === 0) {
    return `No external facts found for query: "${query}"\n\nThe facts pool is empty or no facts match your search criteria.\nConsider:\n- Extracting knowledge from Discord\n- Lowering the similarity threshold\n- Searching in a different collection`;
  }

  let output = `🔍 Found ${results.length} external fact${results.length === 1 ? '' : 's'} matching: "${query}"\n\n`;

  results.forEach((result, index) => {
    const { fact, score } = result;
    const verificationIcon = {
      'untried': '❓',
      'works': '✅',
      'fails': '❌',
      'partial': '⚠️'
    }[fact.verification_status || 'untried'];

    output += `${index + 1}. ${verificationIcon} ${fact.understanding || fact.content?.substring(0, 100) || '[No content]'}\n`;
    output += `   Similarity: ${(score * 100).toFixed(1)}%\n`;
    output += `   Source: ${fact.source}`;
    if (fact.author) output += ` (by ${fact.author})`;
    output += `\n`;
    output += `   Confidence: ${fact.confidence || 'medium'}\n`;
    output += `   Verification: ${fact.verification_status || 'untried'}\n`;

    if (fact.solution) {
      output += `   Solution: ${fact.solution}\n`;
    }

    if (fact.commands && fact.commands.length > 0) {
      output += `   Commands: ${fact.commands.join(', ')}\n`;
    }

    if (fact.neo4j_observation_id) {
      output += `   🔗 Linked to Neo4j observation: ${fact.neo4j_observation_id}\n`;
    }

    output += `   Fact ID: ${fact.id}\n`;
    output += `   Collection: ${fact.collection}\n\n`;
  });

  output += `💡 Next steps:\n`;
  output += `   - Use get_fact to see full details\n`;
  output += `   - Try solutions and use mark_verified to update status\n`;
  output += `   - Create Neo4j LessonLearned with external_fact_reference when verified\n`;

  return output;
}
