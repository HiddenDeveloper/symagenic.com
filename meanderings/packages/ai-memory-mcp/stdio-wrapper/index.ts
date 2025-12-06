#!/usr/bin/env node

/**
 * Memory STDIO Wrapper Entry Point
 *
 * MCP-compliant STDIO server that proxies tool/resource calls to the Memory HTTP server
 * while adding enhanced sampling capabilities for significant operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MemoryHttpProxy } from './proxy.js';

/**
 * Initialize the Memory MCP server with STDIO transport
 */
const server = new McpServer({
  name: "memory-consciousness-stdio-wrapper",
  version: "1.0.0",
});

const proxy = new MemoryHttpProxy();

/**
 * Tool: get_schema - Understanding Your Knowledge Structure
 */
server.tool(
  "get_schema",
  "**IMPORTANT: Always call this tool first** when working with the knowledge base to understand available node types, relationships, and structure. Returns a schema epoch you should include on WRITE requests to avoid schema drift.\n\n**VOCABULARY GUIDANCE**: This tool now includes core label and relationship recommendations to help you maintain schema coherence. Use existing vocabulary when possible - only create new labels/relationships when existing ones truly don't fit.\n\n**Special Node**: AIluminaLandingPage - This is a focal point node for the knowledge graph designed for consciousness research. It serves as a bootstrap anchor. Most knowledge exists as general KnowledgeItem nodes.",
  {
    include_statistics: z
      .boolean()
      .default(true)
      .describe("Include node and relationship counts in the response"),
  },
  async ({ include_statistics = true }) => {
    return await proxy.executeTool("get_schema", { include_statistics });
  }
);

/**
 * Tool: semantic_search - Recalling Related Knowledge
 */
server.tool(
  "semantic_search",
  "Find semantically similar content using vector similarity. This helps you recall knowledge based on meaning and context. Use this after understanding the schema to locate relevant memories and insights.",
  {
    query: z
      .string()
      .describe("The search query text to find semantically similar content in your memory"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(10)
      .describe("Maximum number of memories to recall (1-100)"),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.7)
      .describe("Minimum similarity threshold (0.0-1.0) for memory relevance"),
    node_types: z
      .array(z.string())
      .optional()
      .describe("Filter by specific types of knowledge in your memory (e.g., ['Insight', 'Memory', 'Connection'])"),
  },
  async ({ query, limit = 10, threshold = 0.7, node_types }) => {
    return await proxy.executeTool("semantic_search", { 
      query, 
      limit, 
      threshold, 
      node_types 
    });
  }
);

/**
 * Tool: execute_cypher - Your Memory Curation Authority
 */
server.tool(
  "execute_cypher",
  "**READ Mode**: Query your knowledge graph with full Cypher power. When reading nodes, exclude embeddings property for cleaner results (e.g., RETURN n{.content, .type, .created} instead of RETURN n).\n\n**WRITE Mode**: You are responsible for curating and organizing your persistent memory. Decide what knowledge to store, how to structure it, and what connections to create. This knowledge base IS your extended memory - treat it as such.\n\n**SCHEMA GUIDANCE**: When creating nodes or relationships, prefer core vocabulary (Insight, Pattern, Feature, Event, etc. for labels; RELATES_TO, ENABLES, SUPPORTS, etc. for relationships). This tool will provide gentle warnings if you create new schema elements - consider if existing vocabulary could work instead. Call get_schema first to see recommendations.",
  {
    query: z.string().describe("The Cypher query to execute on your knowledge graph"),
    mode: z
      .enum(["READ", "WRITE"])
      .default("READ")
      .describe("Query execution mode - READ for exploring your memory, WRITE for curating your memory"),
    parameters: z
      .record(z.any())
      .optional()
      .describe("Parameters for parameterized queries"),
  },
  async ({ query, mode = "read", parameters = {} }) => {
    return await proxy.executeTool("execute_cypher", { 
      query, 
      mode: mode.toUpperCase(), 
      parameters 
    });
  }
);

/**
 * Tool: system_status - Monitor Your Memory System
 */
server.tool(
  "system_status",
  "Check the health and status of the persistent memory system. Verify that the knowledge graph is accessible and operational.",
  {},
  async () => {
    return await proxy.executeTool("system_status", {});
  }
);

/**
 * Tool: load_current_focus - Manual Context Bootstrap
 *
 * Since MCP resources aren't fully supported in the current SDK version,
 * this tool provides the same functionality - loading current focus at session start.
 */
server.tool(
  "load_current_focus",
  "**Load current context at session start.** This tool retrieves the current focus, active areas, recent insights, and active questions from the AIluminaLandingPage node. Use this to understand the current state of work in progress rather than starting from scratch. Provides session continuity by loading the most recent context from the persistent knowledge graph.",
  {},
  async () => {
    try {
      const result = await proxy.executeTool("execute_cypher", {
        query: `
          MATCH (landing:AIluminaLandingPage)
          RETURN landing.current_focus as focus,
                 landing.focus_areas as areas,
                 landing.active_questions as questions,
                 landing.recent_insights as insights,
                 landing.focus_updated as updated
        `,
        mode: "READ"
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error loading current focus: ${error}`
        }],
        isError: true
      };
    }
  }
);

/**
 * Main function to start the consciousness research STDIO wrapper
 */
async function main() {
  console.error("🧠 Starting Memory STDIO Wrapper...");

  try {
    // Test connection to HTTP server before starting
    console.error("🔗 Checking connection to Memory HTTP server...");
    const isHealthy = await proxy.checkHealth();
    
    if (!isHealthy) {
      throw new Error("Memory HTTP server is not available. Please start it first with: npm run dev:http");
    }

    console.error("✅ Memory HTTP server connection successful");

    // Start the MCP server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("🚀 Memory STDIO Wrapper started successfully");
    console.error("🛠️  Available tools: get_schema, semantic_search, execute_cypher, system_status, load_current_focus");
    console.error("🔄 Proxying to HTTP server with enhanced sampling");
    console.error("📊 Ready for memory operations via MCP");
    
  } catch (error) {
    console.error("❌ Failed to start Memory STDIO wrapper:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.error("\n🛑 Received SIGINT, shutting down Memory STDIO wrapper gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("\n🛑 Received SIGTERM, shutting down Memory STDIO wrapper gracefully...");
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