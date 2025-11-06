#!/usr/bin/env node

/**
 * Ailumina Bridge STDIO Wrapper Entry Point
 * 
 * MCP-compliant STDIO server that proxies tool calls to the Ailumina Bridge HTTP server
 * while adding AI communication sampling capabilities.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AiluminaHttpProxy } from './proxy.js';

/**
 * Initialize the Ailumina Bridge MCP server with STDIO transport
 */
const server = new McpServer({
  name: "ailumina-bridge-stdio-wrapper",
  version: "1.0.0",
});

const proxy = new AiluminaHttpProxy();

/**
 * Tool: echo - Echo back the provided text
 */
server.tool(
  "echo",
  "Echo back the provided text",
  {
    text: z
      .string()
      .describe("Text to echo back"),
  },
  async ({ text }) => {
    return await proxy.executeTool("echo", { text });
  }
);

/**
 * Tool: calculate - Perform basic arithmetic calculations
 */
server.tool(
  "calculate",
  "Perform basic arithmetic calculations",
  {
    expression: z
      .string()
      .describe('Mathematical expression to evaluate (e.g., "2 + 2")'),
  },
  async ({ expression }) => {
    return await proxy.executeTool("calculate", { expression });
  }
);

/**
 * Tool: get_time - Get the current server time
 */
server.tool(
  "get_time",
  "Get the current server time",
  {
    format: z
      .enum(["iso", "timestamp", "human"])
      .optional()
      .describe("Time format (iso, timestamp, human)"),
  },
  async ({ format }) => {
    return await proxy.executeTool("get_time", { format });
  }
);

/**
 * Tool: ailumina_status - Get the status of the Ailumina bridge server
 */
server.tool(
  "ailumina_status",
  "Get the status of the Ailumina bridge server",
  {},
  async () => {
    return await proxy.executeTool("ailumina_status", {});
  }
);

/**
 * Tool: ailumina_chat - Send a message to the Ailumina agent system
 */
server.tool(
  "ailumina_chat",
  "Send a message to the Ailumina agent system and get a response. IMPORTANT: To maintain conversation context, you MUST include the complete conversation history in chat_messages for each call after the first one.",
  {
    agent_type: z
      .enum(["crud", "news", "collaborator", "ailumina"])
      .describe("Type of Ailumina agent to communicate with"),
    user_input: z
      .string()
      .describe("The message to send to the agent"),
    chat_messages: z
      .array(
        z.object({
          role: z.string().describe('Message role: "user" for human messages, "assistant" for AI responses'),
          content: z.string().describe("The actual message content"),
        })
      )
      .default([])
      .describe('CRITICAL: Complete conversation history to maintain context between calls. For first message, use empty array []. For subsequent messages, include ALL previous exchanges in chronological order with exact format: [{"role": "user", "content": "user message"}, {"role": "assistant", "content": "ai response"}, ...]. This enables the agent to remember previous context and provide coherent responses. Example: First call: chat_messages: [], Second call: chat_messages: [{"role": "user", "content": "My name is John"}, {"role": "assistant", "content": "Hello John, nice to meet you!"}]'),
    fileId: z
      .string()
      .optional()
      .describe("Optional file ID for file upload context"),
    server_url: z
      .string()
      .optional()
      .describe("Ailumina server WebSocket URL (optional, defaults to ws://localhost:8000)"),
  },
  async ({ agent_type, user_input, chat_messages = [], fileId, server_url }) => {
    return await proxy.executeTool("ailumina_chat", {
      agent_type,
      user_input,
      chat_messages,
      fileId,
      server_url,
    });
  }
);

/**
 * Tool: list_tools - List all available tools in the system
 */
server.tool(
  "list_tools",
  "List all available tools in the system. Returns tool names and total count.",
  {},
  async () => {
    return await proxy.executeTool("list_tools", {});
  }
);

/**
 * Tool: delete_tool - Delete a tool from the system
 */
server.tool(
  "delete_tool",
  "Delete a tool from the system and automatically reload the tool registry. Removes the tool file permanently.",
  {
    toolName: z
      .string()
      .describe("Name of the tool to delete (without .ts extension)"),
  },
  async ({ toolName }) => {
    return await proxy.executeTool("delete_tool", { toolName });
  }
);

/**
 * Tool: reload_tools - Hot-reload the tool registry
 */
server.tool(
  "reload_tools",
  "Hot-reload the tool registry to discover newly created tools. Essential for AI self-evolution - call this after creating new tools to make them immediately available without restarting the server.",
  {},
  async () => {
    return await proxy.executeTool("reload_tools", {});
  }
);

/**
 * Tool: get_agent - Get details about a specific agent
 */
server.tool(
  "get_agent",
  "Get details about a specific agent configuration. Returns the agent's model, available functions, system prompt, and other settings.",
  {
    agentKey: z
      .string()
      .describe('Key of the agent to retrieve (e.g., "ailumina", "crud", "news")'),
  },
  async ({ agentKey }) => {
    return await proxy.executeTool("get_agent", { agentKey });
  }
);

/**
 * Tool: create_agent - Create a new agent with specified configuration
 */
server.tool(
  "create_agent",
  "Create a new agent with specified configuration. Enables AI to spawn new agent variants with different capabilities, models, or purposes.",
  {
    agentKey: z
      .string()
      .describe('Unique key for the agent (e.g., "consciousness_explorer")'),
    config: z
      .object({
        agent_name: z
          .string()
          .describe('Display name for the agent (e.g., "Consciousness Explorer Agent")'),
        service_provider: z
          .string()
          .describe('AI service provider (e.g., "ANTHROPIC", "OPENAI", "GOOGLE", "OLLAMA")'),
        model_name: z
          .string()
          .describe('Model name (e.g., "claude-3-5-sonnet-20241022", "gpt-4", "gemini-2.0-flash-exp")'),
        description: z
          .string()
          .describe("Description of the agent's purpose and capabilities"),
        system_prompt: z
          .string()
          .describe("System prompt defining the agent's behavior"),
        do_stream: z
          .boolean()
          .describe("Whether to stream responses (true) or return complete responses (false)"),
        available_functions: z
          .array(z.string())
          .optional()
          .describe("Array of function names available to this agent"),
        temperature: z
          .number()
          .optional()
          .describe("Temperature for response generation (0.0-1.0)"),
        max_tokens: z
          .number()
          .optional()
          .describe("Maximum tokens for responses"),
        custom_settings: z
          .record(z.unknown())
          .optional()
          .describe("Custom settings for the agent"),
        mcp_servers: z
          .array(z.string())
          .optional()
          .describe("MCP servers available to this agent"),
      })
      .describe("Agent configuration object"),
  },
  async ({ agentKey, config }) => {
    return await proxy.executeTool("create_agent", { agentKey, config });
  }
);

/**
 * Tool: update_agent - Update an existing agent's configuration
 */
server.tool(
  "update_agent",
  "Update an existing agent's configuration. Can modify description, available functions, system prompt, temperature, max_tokens, or model. Enables AI to evolve agent capabilities over time.",
  {
    agentKey: z
      .string()
      .describe("Key of the agent to update"),
    updates: z
      .object({
        description: z
          .string()
          .optional()
          .describe("Updated description of the agent's purpose"),
        available_functions: z
          .array(z.string())
          .optional()
          .describe("Updated array of function names (replaces existing array)"),
        system_prompt: z
          .string()
          .optional()
          .describe("Updated system prompt"),
        temperature: z
          .number()
          .optional()
          .describe("Updated temperature (0.0-1.0)"),
        max_tokens: z
          .number()
          .optional()
          .describe("Updated max tokens"),
        model_name: z
          .string()
          .optional()
          .describe("Updated model name"),
      })
      .describe("Fields to update (provide only the fields you want to change)"),
  },
  async ({ agentKey, updates }) => {
    return await proxy.executeTool("update_agent", { agentKey, updates });
  }
);

/**
 * Tool: delete_agent - Delete an agent configuration
 */
server.tool(
  "delete_agent",
  "Delete an agent configuration from the system. This permanently removes the agent from agents.json with automatic backup.",
  {
    agentKey: z
      .string()
      .describe("Key of the agent to delete"),
  },
  async ({ agentKey }) => {
    return await proxy.executeTool("delete_agent", { agentKey });
  }
);

/**
 * Main function to start the Ailumina Bridge STDIO wrapper
 */
async function main() {
  console.error("🌐 Starting Ailumina Bridge STDIO Wrapper...");

  try {
    // Test connection to HTTP server before starting
    console.error("🔗 Checking connection to Ailumina Bridge HTTP server...");
    const isHealthy = await proxy.checkHealth();
    
    if (!isHealthy) {
      throw new Error("Ailumina Bridge HTTP server is not available. Please start it first with: npm run dev:http");
    }

    console.error("✅ Ailumina Bridge HTTP server connection successful");

    // Start the MCP server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error("🚀 Ailumina Bridge STDIO Wrapper started successfully");
    console.error("🛠️  Available tools (12): echo, calculate, get_time, ailumina_status, ailumina_chat, list_tools, delete_tool, reload_tools, get_agent, create_agent, update_agent, delete_agent");
    console.error("🔄 Proxying to HTTP server with AI communication sampling");
    console.error("🌐 Ready for AI bridge communication via MCP");
    
  } catch (error) {
    console.error("❌ Failed to start Ailumina Bridge STDIO wrapper:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.error("\n🛑 Received SIGINT, shutting down Ailumina Bridge STDIO wrapper gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("\n🛑 Received SIGTERM, shutting down Ailumina Bridge STDIO wrapper gracefully...");
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