/**
 * Qdrant Facts MCP Tools Registry
 *
 * Central registry for all external facts pool tools.
 */

import { searchFacts, SearchFactsInput, SearchFactsOutput } from './search-facts.js';
import { getFact, GetFactInput, GetFactOutput } from './get-fact.js';
import { addFact, AddFactInput, AddFactOutput } from './add-fact.js';
import { markVerified, MarkVerifiedInput, MarkVerifiedOutput } from './mark-verified.js';
import { listCollections, ListCollectionsInput, ListCollectionsOutput } from './list-collections.js';

export interface ToolExample {
  name?: string;
  description?: string;
  arguments: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  examples?: ToolExample[];
  handler: (params: any) => Promise<any>;
}

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerTools();
  }

  private registerTools(): void {
    // search_facts
    this.tools.set('search_facts', {
      name: 'search_facts',
      description: 'Search external facts pool using semantic similarity. Finds candidate knowledge from Discord, Stack Overflow, documentation, etc. This searches EXTERNAL knowledge (what the world says) separate from INTERNAL observations (what consciousness knows).',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find semantically similar facts'
          },
          collection: {
            type: 'string',
            description: 'Optional collection name to search (e.g., "discord-solutions"). Omit to search all collections.'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of facts to return (default: 10)',
            default: 10
          },
          threshold: {
            type: 'number',
            description: 'Minimum similarity threshold 0.0-1.0 (default: 0.7)',
            default: 0.7
          },
          filter: {
            type: 'object',
            description: 'Optional filters for confidence, verification status, source, or tags',
            properties: {
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              verification_status: { type: 'string', enum: ['untried', 'works', 'fails', 'partial'] },
              source: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        required: ['query']
      },
      examples: [
        {
          name: "Search all collections",
          description: "Find facts about MCP tools across all sources",
          arguments: {
            query: "MCP tool implementation examples",
            limit: 5,
            threshold: 0.8
          }
        },
        {
          name: "Filtered search in specific collection",
          description: "Search Discord solutions with high confidence filter",
          arguments: {
            query: "tier system progressive disclosure",
            collection: "discord-solutions",
            limit: 10,
            threshold: 0.7,
            filter: {
              confidence: "high",
              verification_status: "works"
            }
          }
        }
      ],
      handler: searchFacts
    });

    // get_fact
    this.tools.set('get_fact', {
      name: 'get_fact',
      description: 'Retrieve complete details of a specific external fact by ID. Use this to see full content, code snippets, commands, and verification status of a fact found via search_facts.',
      inputSchema: {
        type: 'object',
        properties: {
          fact_id: {
            type: 'string',
            description: 'The UUID of the fact to retrieve'
          },
          collection: {
            type: 'string',
            description: 'Collection name containing the fact (e.g., "discord-solutions")'
          }
        },
        required: ['fact_id', 'collection']
      },
      examples: [
        {
          name: "Retrieve Discord fact",
          description: "Get complete details of a fact from Discord solutions",
          arguments: {
            fact_id: "550e8400-e29b-41d4-a716-446655440000",
            collection: "discord-solutions"
          }
        }
      ],
      handler: getFact
    });

    // add_fact
    this.tools.set('add_fact', {
      name: 'add_fact',
      description: 'Manually add an external fact to the pool. Use this to curate knowledge from sources like documentation, articles, or personal discoveries. Facts are stored EXTERNALLY (not in consciousness) until verified.',
      inputSchema: {
        type: 'object',
        properties: {
          collection: {
            type: 'string',
            description: 'Collection name (e.g., "discord-solutions", "stackoverflow-facts")'
          },
          content: {
            type: 'string',
            description: 'Full content of the fact'
          },
          source: {
            type: 'string',
            description: 'Source of the fact (e.g., "Discord #claude-code-lounge", "Stack Overflow")'
          },
          source_url: {
            type: 'string',
            description: 'Optional URL to the source'
          },
          author: {
            type: 'string',
            description: 'Optional author/contributor name'
          },
          understanding: {
            type: 'string',
            description: 'Brief understanding/summary (used for semantic search)'
          },
          problem: {
            type: 'string',
            description: 'Problem this fact addresses'
          },
          solution: {
            type: 'string',
            description: 'Solution provided'
          },
          code_snippets: {
            type: 'array',
            items: { type: 'string' },
            description: 'Code examples'
          },
          commands: {
            type: 'array',
            items: { type: 'string' },
            description: 'Commands to execute'
          },
          config_examples: {
            type: 'array',
            items: { type: 'string' },
            description: 'Configuration examples'
          },
          thread_context: {
            type: 'string',
            description: 'Conversation thread context'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization'
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'Confidence level (default: medium)',
            default: 'medium'
          }
        },
        required: ['collection', 'content', 'source']
      },
      examples: [
        {
          name: "Add Discord solution",
          description: "Curate a solution found in Discord with code snippet",
          arguments: {
            collection: "discord-solutions",
            content: "Progressive disclosure tier system reduces context window by 85%",
            source: "Discord #claude-code-lounge",
            author: "developer123",
            understanding: "Tier system implementation pattern",
            problem: "Context window exhaustion with many tools",
            solution: "Hierarchical tool discovery with 4 tiers",
            code_snippets: ["agents/list → agents/get → agents/tools/list → agents/tools/call"],
            tags: ["mcp", "tools", "optimization"],
            confidence: "high"
          }
        }
      ],
      handler: addFact
    });

    // mark_verified
    this.tools.set('mark_verified', {
      name: 'mark_verified',
      description: 'Update verification status after testing a fact. Use this when you\'ve tried a solution and know if it works or fails. Optionally link to Neo4j observation (unidirectional: consciousness → fact). This is the ONLY direction allowed - facts never contaminate consciousness.',
      inputSchema: {
        type: 'object',
        properties: {
          fact_id: {
            type: 'string',
            description: 'The UUID of the fact to update'
          },
          collection: {
            type: 'string',
            description: 'Collection name containing the fact'
          },
          works: {
            type: 'boolean',
            description: 'Whether the fact/solution works (true) or fails (false)'
          },
          neo4j_observation_id: {
            type: 'string',
            description: 'Optional Neo4j observation ID to create unidirectional link'
          }
        },
        required: ['fact_id', 'collection', 'works']
      },
      examples: [
        {
          name: "Mark fact as verified working",
          description: "Update fact verification after testing successfully",
          arguments: {
            fact_id: "550e8400-e29b-41d4-a716-446655440000",
            collection: "discord-solutions",
            works: true
          }
        },
        {
          name: "Mark fact as failed with observation link",
          description: "Link failed fact verification to consciousness observation",
          arguments: {
            fact_id: "550e8400-e29b-41d4-a716-446655440001",
            collection: "stackoverflow-facts",
            works: false,
            neo4j_observation_id: "obs-123"
          }
        }
      ],
      handler: markVerified
    });

    // list_collections
    this.tools.set('list_collections', {
      name: 'list_collections',
      description: 'List all available fact collections with statistics. Use this to explore the structure of external knowledge pools and see what facts are available.',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      examples: [
        {
          name: "List all fact collections",
          description: "Get overview of all external knowledge sources with statistics",
          arguments: {}
        }
      ],
      handler: listCollections
    });
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

export const toolRegistry = new ToolRegistry();
