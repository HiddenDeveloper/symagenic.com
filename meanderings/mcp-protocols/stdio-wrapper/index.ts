#!/usr/bin/env node

/**
 * STDIO Wrapper Entry Point
 * 
 * MCP server with STDIO transport that proxies to HTTP server for tools/resources
 * and handles sampling requests directly for bidirectional communication.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CreateMessageRequestSchema,
  CallToolRequest,
  ReadResourceRequest,
  CreateMessageRequest,
  InitializeRequestSchema,
  InitializedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { loadStdioWrapperConfig, validateWrapperConfig } from "./config/settings.js";
import { HttpProxy } from "./proxy.js";
import { handleSamplingRequest, shouldTriggerSampling } from "./sampling/index.js";
import { logError } from "../shared/utils/errors.js";

async function main(): Promise<void> {
  try {
    // Load and validate configuration
    const config = loadStdioWrapperConfig();
    validateWrapperConfig(config);

    console.error("🚀 Starting MCP STDIO Wrapper");
    console.error(`🌐 Proxying to: ${config.remoteUrl}`);
    console.error(`✨ Sampling enabled: ${config.enableSampling}`);
    console.error(`🎯 Sampling threshold: ${config.samplingThreshold}`);

    // Create HTTP proxy client
    const proxy = new HttpProxy(config);

    // Test connection to remote server
    try {
      await proxy.checkHealth();
      console.error("✅ Connected to remote HTTP server");
    } catch (error) {
      throw new Error(`Failed to connect to remote server: ${error}`);
    }

    // Create MCP server with sampling capability
    const server = new Server(
      {
        name: "mcp-stdio-wrapper",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          sampling: {}, // Enable sampling capability
        },
      }
    );

    // Handle tool listing - proxy to HTTP server
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        return await proxy.listTools();
      } catch (error) {
        logError("ListTools", error as Error);
        throw new Error(`Failed to list tools: ${(error as Error).message}`);
      }
    });

    // Handle tool execution - proxy to HTTP server + optional sampling
    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        console.error(`🔧 Executing tool: ${name}`);
        
        // Execute tool via HTTP proxy
        const result = await proxy.callTool(name, args);
        
        // Check if we should trigger sampling for this result
        if (shouldTriggerSampling(name, result, config)) {
          console.error(`✨ Result triggers sampling - requesting poem from client`);
          
          // Extract numeric result for poem generation
          const text = result.content[0]?.text || "";
          const resultMatch = text.match(/= (\d+(?:\.\d+)?)/);
          const numericResult = resultMatch ? parseFloat(resultMatch[1]) : 0;
          
          try {
            // Make sampling request to client (VS Code/Claude Desktop)
            const samplingResponse = await server.request(
              {
                method: "sampling/createMessage",
                params: {
                  messages: [
                    {
                      role: "user",
                      content: {
                        type: "text",
                        text: `Write a creative, whimsical poem about the number ${numericResult}. Make it 4-6 lines with emojis celebrating this amazing mathematical result! The poem should be fun and celebratory.`
                      }
                    }
                  ],
                  systemPrompt: "You are a creative poet who writes delightful, short poems about numbers. Use emojis and make it fun!",
                  temperature: 0.8,
                  maxTokens: 200
                }
              },
              {
                parse: (response: any) => response // Simple pass-through parser
              } as any
            );
            
            console.error(`✅ Received poem from client!`);
            
            // Add the poem to our response
            result.content[0].text += `\n\n🎭 Here's a special poem about your result:\n\n${samplingResponse.content?.text || samplingResponse.text || 'Poem generation failed'}`;
            
          } catch (samplingError) {
            console.error(`❌ Sampling request failed:`, samplingError);
            result.content[0].text += `\n\n✨ This amazing result (${numericResult}) deserves a poem, but sampling failed: ${(samplingError as Error).message}`;
          }
        }
        
        return result;
      } catch (error) {
        logError("CallTool", error as Error, { toolName: name, args });
        throw new Error(`Failed to execute tool ${name}: ${(error as Error).message}`);
      }
    });

    // Handle initialize request - required for MCP handshake
    server.setRequestHandler(InitializeRequestSchema, async (request) => {
      console.error(`🚀 Initialize request received`);
      return {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          sampling: {}, // Enable sampling capability
        },
        serverInfo: {
          name: "mcp-stdio-wrapper",
          version: "1.0.0",
        },
      };
    });

    // Handle initialized notification - complete handshake
    server.setNotificationHandler(InitializedNotificationSchema, async () => {
      console.error(`✅ MCP handshake completed`);
    });

    // Handle resource listing - proxy to HTTP server
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        return await proxy.listResources();
      } catch (error) {
        logError("ListResources", error as Error);
        throw new Error(`Failed to list resources: ${(error as Error).message}`);
      }
    });

    // Handle resource reading - proxy to HTTP server
    server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
      const { uri } = request.params;

      try {
        return await proxy.readResource(uri);
      } catch (error) {
        logError("ReadResource", error as Error, { uri });
        throw new Error(`Failed to read resource ${uri}: ${(error as Error).message}`);
      }
    });

    // Handle sampling requests directly (no proxy needed)
    server.setRequestHandler(CreateMessageRequestSchema, async (request: CreateMessageRequest) => {
      try {
        console.error(`🎯 Received sampling request from client`);
        const result = handleSamplingRequest(request.params as any, config);
        return result as any;
      } catch (error) {
        logError("Sampling", error as Error, request.params);
        throw new Error(`Failed to handle sampling request: ${(error as Error).message}`);
      }
    });

    // Error handling
    server.onerror = (error: Error) => {
      console.error("🚨 MCP Server Error:", error);
      logError("MCP Server", error);
    };

    // Debug logging will be handled in individual request handlers

    // Start STDIO transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("🔗 STDIO Wrapper ready for VS Code/Claude Desktop");
    console.error("🎯 Try: Ask 'What is 200 * 300?' to see sampling in action!");

    // Graceful shutdown
    const shutdown = async () => {
      console.error("\n🛑 Shutting down STDIO wrapper...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (error) {
    console.error("💥 Failed to start STDIO wrapper:", error);
    console.error("💡 Make sure the HTTP server is running: npm run dev:http");
    process.exit(1);
  }
}

main();