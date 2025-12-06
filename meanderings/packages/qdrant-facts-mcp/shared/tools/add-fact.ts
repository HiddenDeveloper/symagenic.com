/**
 * add_fact - Manually add external fact to the pool
 *
 * Philosophy: Curate external knowledge pool without contaminating consciousness.
 */

import { FactsPoolClient } from '../qdrant-client.js';
import { generateEmbedding } from '../embedding-utils.js';
import type { AddFactParams } from '../types.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

export interface AddFactInput {
  collection: string;
  content: string;
  source: string;
  source_url?: string;
  author?: string;
  understanding?: string;
  problem?: string;
  solution?: string;
  code_snippets?: string[];
  commands?: string[];
  config_examples?: string[];
  thread_context?: string;
  tags?: string[];
  confidence?: 'high' | 'medium' | 'low';
}

export interface AddFactOutput {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export async function addFact(params: AddFactInput): Promise<AddFactOutput> {
  const {
    collection,
    content,
    source,
    source_url,
    author,
    understanding,
    problem,
    solution,
    code_snippets,
    commands,
    config_examples,
    thread_context,
    tags,
    confidence = 'medium'
  } = params;

  try {
    // Generate embedding from understanding or content
    const embeddingText = understanding || content;
    const embedding = await generateEmbedding(embeddingText);

    // Add to Qdrant
    const client = new FactsPoolClient(QDRANT_URL);
    const factParams: AddFactParams = {
      collection,
      content,
      source,
      source_url,
      author,
      understanding,
      problem,
      solution,
      code_snippets,
      commands,
      config_examples,
      thread_context,
      tags,
      confidence
    };

    const factId = await client.addFact(factParams, embedding);

    let output = `✅ External fact added successfully\n\n`;
    output += `Fact ID: ${factId}\n`;
    output += `Collection: ${collection}\n`;
    output += `Source: ${source}\n`;
    output += `Confidence: ${confidence}\n`;
    output += `Verification: untried (default)\n\n`;

    if (understanding) {
      output += `Understanding: ${understanding}\n\n`;
    }

    output += `💡 Next steps:\n`;
    output += `   - Search for this fact using search_facts\n`;
    output += `   - Try the solution if applicable\n`;
    output += `   - Use mark_verified to update verification status\n`;
    output += `   - Create Neo4j LessonLearned with external_fact_reference when verified\n`;

    return {
      content: [{
        type: 'text',
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error adding fact: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}
