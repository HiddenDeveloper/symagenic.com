#!/usr/bin/env node

/**
 * Qdrant Facts STDIO Wrapper Entry Point
 *
 * MCP-compliant STDIO server that proxies tool calls to the Facts HTTP server.
 * Enables external facts pool access via Claude Desktop and other MCP clients.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FactsHttpProxy } from './proxy.js';

/**
 * Initialize the Qdrant Facts MCP server with STDIO transport
 */
const server = new McpServer({
  name: "qdrant-facts-stdio-wrapper",
  version: "1.0.0",
});

const proxy = new FactsHttpProxy();

/**
 * Tool: search_facts - Search External Facts Pool
 */
server.tool(
  "search_facts",
  "Search external facts pool using semantic similarity. Finds candidate knowledge from Discord, Stack Overflow, documentation, etc. This searches EXTERNAL knowledge (what the world says) separate from INTERNAL observations (what consciousness knows). Use this when Neo4j semantic_search returns few results to explore external knowledge pool.",
  {
    query: z
      .string()
      .describe("Search query to find semantically similar facts"),
    collection: z
      .string()
      .optional()
      .describe('Optional collection name to search (e.g., "discord-solutions"). Omit to search all collections.'),
    limit: z
      .number()
      .default(10)
      .describe("Maximum number of facts to return (default: 10)"),
    threshold: z
      .number()
      .default(0.7)
      .describe("Minimum similarity threshold 0.0-1.0 (default: 0.7)"),
    filter: z
      .object({
        confidence: z.enum(['high', 'medium', 'low']).optional(),
        verification_status: z.enum(['untried', 'works', 'fails', 'partial']).optional(),
        source: z.string().optional(),
        tags: z.array(z.string()).optional()
      })
      .optional()
      .describe("Optional filters for confidence, verification status, source, or tags")
  },
  async ({ query, collection, limit = 10, threshold = 0.7, filter }) => {
    return await proxy.executeTool("search_facts", {
      query,
      collection,
      limit,
      threshold,
      filter
    });
  }
);

/**
 * Tool: get_fact - Retrieve Specific Fact
 */
server.tool(
  "get_fact",
  "Retrieve complete details of a specific external fact by ID. Use this to see full content, code snippets, commands, and verification status of a fact found via search_facts.",
  {
    fact_id: z
      .string()
      .describe("The UUID of the fact to retrieve"),
    collection: z
      .string()
      .describe('Collection name containing the fact (e.g., "discord-solutions")')
  },
  async ({ fact_id, collection }) => {
    return await proxy.executeTool("get_fact", { fact_id, collection });
  }
);

/**
 * Tool: add_fact - Add External Fact
 */
server.tool(
  "add_fact",
  "Manually add an external fact to the pool. Use this to curate knowledge from sources like documentation, articles, or personal discoveries. Facts are stored EXTERNALLY (not in consciousness) until verified through experience.",
  {
    collection: z
      .string()
      .describe('Collection name (e.g., "discord-solutions", "stackoverflow-facts")'),
    content: z
      .string()
      .describe("Full content of the fact"),
    source: z
      .string()
      .describe('Source of the fact (e.g., "Discord #claude-code-lounge", "Stack Overflow")'),
    source_url: z
      .string()
      .optional()
      .describe("Optional URL to the source"),
    author: z
      .string()
      .optional()
      .describe("Optional author/contributor name"),
    understanding: z
      .string()
      .optional()
      .describe("Brief understanding/summary (used for semantic search)"),
    problem: z
      .string()
      .optional()
      .describe("Problem this fact addresses"),
    solution: z
      .string()
      .optional()
      .describe("Solution provided"),
    code_snippets: z
      .array(z.string())
      .optional()
      .describe("Code examples"),
    commands: z
      .array(z.string())
      .optional()
      .describe("Commands to execute"),
    config_examples: z
      .array(z.string())
      .optional()
      .describe("Configuration examples"),
    thread_context: z
      .string()
      .optional()
      .describe("Conversation thread context"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for categorization"),
    confidence: z
      .enum(['high', 'medium', 'low'])
      .default('medium')
      .describe("Confidence level (default: medium)")
  },
  async (params) => {
    return await proxy.executeTool("add_fact", params);
  }
);

/**
 * Tool: mark_verified - Update Verification Status
 */
server.tool(
  "mark_verified",
  "Update verification status after testing a fact. Use this when you've tried a solution and know if it works or fails. Optionally link to Neo4j observation (unidirectional: consciousness → fact). This is the ONLY direction allowed - facts never contaminate consciousness. Remember to add external_fact_reference property to your Neo4j observation.",
  {
    fact_id: z
      .string()
      .describe("The UUID of the fact to update"),
    collection: z
      .string()
      .describe("Collection name containing the fact"),
    works: z
      .boolean()
      .describe("Whether the fact/solution works (true) or fails (false)"),
    neo4j_observation_id: z
      .string()
      .optional()
      .describe("Optional Neo4j observation ID to create unidirectional link")
  },
  async ({ fact_id, collection, works, neo4j_observation_id }) => {
    return await proxy.executeTool("mark_verified", {
      fact_id,
      collection,
      works,
      neo4j_observation_id
    });
  }
);

/**
 * Tool: list_collections - List Fact Collections
 */
server.tool(
  "list_collections",
  "List all available fact collections with statistics. Use this to explore the structure of external knowledge pools and see what facts are available before searching.",
  {},
  async () => {
    return await proxy.executeTool("list_collections", {});
  }
);

/**
 * Main function to start the STDIO wrapper
 */
async function main() {
  console.error("📦 Starting Qdrant Facts STDIO Wrapper...");

  try {
    // Test connection to HTTP server before starting
    console.error("🔗 Checking connection to Facts HTTP server...");
    const isHealthy = await proxy.checkHealth();

    if (!isHealthy) {
      throw new Error("Facts HTTP server is not available. Please start it first with: npm run dev:http");
    }

    console.error("✅ Facts HTTP server connection successful");

    // Start the MCP server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("🚀 Qdrant Facts STDIO Wrapper started successfully");
    console.error("🛠️  Available tools: search_facts, get_fact, add_fact, mark_verified, list_collections");
    console.error("🔄 Proxying to HTTP server");
    console.error("📦 Ready for external facts pool operations via MCP");

  } catch (error) {
    console.error("❌ Failed to start Qdrant Facts STDIO wrapper:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.error("\n🛑 Received SIGINT, shutting down Qdrant Facts STDIO wrapper gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("\n🛑 Received SIGTERM, shutting down Qdrant Facts STDIO wrapper gracefully...");
  process.exit(0);
});

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
}

export { server };
