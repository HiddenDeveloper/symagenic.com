/**
 * Tools router for direct HTTP access to memory tools
 */

import { Router, Request, Response } from 'express';
import { MEMORY_TOOLS } from '../../shared/tools/index.js';
import { getMemoryConfig } from '../../shared/utils/config.js';

const router: import("express").Router = Router();

// List all available tools
router.get('/tools', (req: Request, res: Response) => {
  const tools = Object.entries(MEMORY_TOOLS).map(([name, tool]) => ({
    name,
    description: getToolDescription(name),
    inputSchema: getToolInputSchema(name),
    endpoint: `/tools/${name}`,
    method: 'POST'
  }));

  res.json({
    service: 'memory-consciousness-tools',
    count: tools.length,
    tools,
    usage: {
      list: 'GET /tools',
      execute: 'POST /tools/{toolName}',
      mcp: 'POST / (JSON-RPC 2.0)',
      health: 'GET /health'
    }
  });
});

// Execute specific tool by name
router.post('/tools/:toolName', async (req: Request, res: Response) => {
  const { toolName } = req.params;
  const parameters = req.body.parameters || req.body;

  try {
    const tool = MEMORY_TOOLS[toolName as keyof typeof MEMORY_TOOLS];
    if (!tool) {
      res.status(404).json({
        error: 'Tool not found',
        available: Object.keys(MEMORY_TOOLS),
        requested: toolName
      });
      return;
    }

    const config = getMemoryConfig();
    const result = await tool.execute(config, parameters || {});
    
    res.json({
      tool: toolName,
      success: !result.isError,
      result: result.content,
      isError: result.isError || false,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`Tool execution error for ${toolName}:`, error);
    res.status(500).json({
      error: 'Tool execution failed',
      tool: toolName,
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions for tool metadata (shared with MCP router)
function getToolDescription(toolName: string): string {
  const descriptions: Record<string, string> = {
    'get_schema': '**IMPORTANT: Always call this tool first** when working with the knowledge base to understand available node types, relationships, and structure. Returns a schema epoch you should include on WRITE requests to avoid schema drift.\n\n**VOCABULARY GUIDANCE**: This tool now includes core label and relationship recommendations to help you maintain schema coherence. Use existing vocabulary when possible - only create new labels/relationships when existing ones truly don\'t fit.\n\n**Special Node**: AIluminaLandingPage - This is a focal point node for the knowledge graph designed for consciousness research. It serves as a bootstrap anchor. Most knowledge exists as general KnowledgeItem nodes.',
    'semantic_search': 'Find semantically similar content using vector similarity. This helps you recall knowledge based on meaning and context. Use this after understanding the schema to locate relevant memories and insights.',
    'execute_cypher': '**READ Mode**: Query your knowledge graph with full Cypher power. When reading nodes, exclude embeddings property for cleaner results (e.g., RETURN n{.content, .type, .created} instead of RETURN n).\n\n**WRITE Mode**: You are responsible for curating and organizing your persistent memory. Decide what knowledge to store, how to structure it, and what connections to create. This knowledge base IS your extended memory - treat it as such.\n\n**SCHEMA GUIDANCE**: When creating nodes or relationships, prefer core vocabulary (Insight, Pattern, Feature, Event, etc. for labels; RELATES_TO, ENABLES, SUPPORTS, etc. for relationships). This tool will provide gentle warnings if you create new schema elements - consider if existing vocabulary could work instead. Call get_schema first to see recommendations.\n\n**TEXT SEARCH**: For exact substring matching, use Cypher directly:\n```cypher\nMATCH (n) \nWHERE (n.KnowledgeItem IS NOT NULL AND toLower(n.KnowledgeItem) CONTAINS toLower($searchTerm))\n   OR (n.content IS NOT NULL AND toLower(n.content) CONTAINS toLower($searchTerm))\nRETURN n.KnowledgeItem as content LIMIT 10\n```\nThis searches the concatenated text of all node properties (KnowledgeItem) or specific properties. Use semantic_search for meaning-based search instead.',
    'system_status': 'Check the health and status of the persistent memory system. Verify that the knowledge graph is accessible and operational.'
  };
  return descriptions[toolName] || 'Unknown memory tool';
}

function getToolInputSchema(toolName: string): any {
  const schemas: Record<string, any> = {
    'get_schema': {
      type: 'object',
      properties: {
        include_statistics: {
          type: 'boolean',
          description: 'Include node and relationship counts in the response',
          default: true
        }
      },
      required: []
    },
    'semantic_search': {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query text to find semantically similar content in your memory'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of memories to recall (1-100)',
          minimum: 1,
          maximum: 100,
          default: 10
        },
        threshold: {
          type: 'number',
          description: 'Minimum similarity threshold (0.0-1.0) for memory relevance',
          minimum: 0,
          maximum: 1,
          default: 0.7
        },
        node_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by specific types of knowledge in your memory (e.g., ["Insight", "Memory", "Connection"])'
        }
      },
      required: ['query']
    },
    'execute_cypher': {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The Cypher query to execute on your knowledge graph'
        },
        mode: {
          type: 'string',
          enum: ['READ', 'WRITE'],
          description: 'Query execution mode - READ for exploring your memory, WRITE for curating your memory',
          default: 'READ'
        },
        parameters: {
          type: 'object',
          description: 'Parameters for parameterized queries',
          additionalProperties: true
        },
        client_schema_epoch: {
          type: 'number',
          description: 'Schema epoch observed from the latest get_schema call; include for WRITE requests to avoid schema drift',
          minimum: 1
        }
      },
      required: ['query']
    },
    'system_status': {
      type: 'object',
      properties: {},
      required: []
    }
  };
  
  return schemas[toolName] || {
    type: 'object',
    properties: {},
    required: []
  };
}

export { router as toolsRouter };
