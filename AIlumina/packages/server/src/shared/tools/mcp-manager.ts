import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ServerConfig } from '../config/server-config.js';
import { TRANSPORT_TYPES } from '../constants/message-constants.js';
import winston from 'winston';

// MCP Tool Definition removed (unused interface)

/**
 * MCP Server Client with Connection Management
 */
interface MCPServerClient {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
  process?: unknown; // Transport manages the process
  connected: boolean;
}

/**
 * MCP Client Manager - TypeScript equivalent of Python MCPClientManager
 */
export class MCPClientManager {
  private serverConfigs: Record<string, ServerConfig>;
  private sessions: Record<string, MCPServerClient> = {};
  private serverTools: Record<string, Record<string, unknown>> = {};
  private _shutdownEvent = false;
  private _readyEvent = false;
  private logger: winston.Logger;

  constructor(logger: winston.Logger, serverConfigs: Record<string, ServerConfig>) {
    this.logger = logger;
    this.serverConfigs = serverConfigs;
  }

  /**
   * Initialize the MCP client manager - equivalent to Python startup()
   */
  async startup(): Promise<void> {
    this.logger.info('🚀 Starting MCP Client Manager...');
    this.logger.info(`📋 Configured servers: ${Object.keys(this.serverConfigs).join(', ')}`);

    try {
      this.logger.debug(`📊 Sessions before initialization: ${Object.keys(this.sessions).length}`);
      await this.initializeSessions();
      this.logger.debug(`📊 Sessions after initialization: ${Object.keys(this.sessions).length}`);
      this.logger.debug(`📊 Active sessions: ${Object.keys(this.sessions).length}`);

      // Load tools from active sessions
      this.logger.info('🔧 Loading tools from active sessions...');
      await this.loadTools();

      this._readyEvent = true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`MCP client manager encountered an error during startup: ${errorMessage}`);
      this._readyEvent = true; // Signal readiness even if initialization fails
    }

    this.logger.info('✅ MCP Client Manager startup completed');
  }

  /**
   * Initialize MCP sessions with robust error handling
   */
  private async initializeSessions(): Promise<void> {
    const connectionTimeout = parseInt(process.env.MCP_CONNECT_TIMEOUT || '15000'); // 15 second timeout
    const connectionResults: { successful: string[]; failed: string[] } = {
      successful: [],
      failed: [],
    };

    for (const [serverName, config] of Object.entries(this.serverConfigs)) {
      try {
        if (config.transport_type === TRANSPORT_TYPES.HTTP) {
          await this.initializeHttpSession(serverName, config, connectionTimeout);
          connectionResults.successful.push(serverName);
        } else {
          await this.initializeStdioSession(serverName, config, connectionTimeout);
          connectionResults.successful.push(serverName);
        }
      } catch (error: unknown) {
        let errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('spawn') || errorMsg.includes('ENOENT')) {
          errorMsg = 'Command not found';
        } else if (errorMsg.includes('timeout')) {
          errorMsg = 'Connection timeout';
        }

        this.logger.warn(`⚠️  ${serverName} (${config.transport_type}): ${errorMsg}`);
        connectionResults.failed.push(`${serverName} (${errorMsg})`);
        continue;
      }
    }

    // Report connection results
    if (connectionResults.successful.length > 0) {
      this.logger.info(`✅ Connected to: ${connectionResults.successful.join(', ')}`);
    }
    if (connectionResults.failed.length > 0) {
      this.logger.info(`⚠️  Failed connections: ${connectionResults.failed.join(', ')}`);
    }
  }

  /**
   * Initialize HTTP MCP session with timeout and validation
   */
  private async initializeHttpSession(
    serverName: string,
    config: ServerConfig,
    timeout: number
  ): Promise<void> {
    if (!config.url) {
      throw new Error('URL is required for HTTP transport');
    }

    this.logger.debug(`Connecting to ${serverName} via HTTP (url: ${config.url})...`);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`HTTP connection timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Create HTTP transport
        const transport = new StreamableHTTPClientTransport(
          new URL(config.url!), // We already validated url exists above
          {
            // Add auth token if provided
            requestInit: config.auth_token
              ? {
                  headers: {
                    Authorization: `Bearer ${config.auth_token}`,
                  },
                }
              : undefined,
          }
        );

        // Create MCP client
        const client = new Client(
          {
            name: `ailumina-mcp-client`,
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        // Connect client to transport
        client
          .connect(transport)
          .then(async () => {
            try {
              // Validate connection by testing basic functionality
              await this.validateSession(client, serverName);

              this.sessions[serverName] = {
                client,
                transport,
                process: undefined, // Not applicable for HTTP
                connected: true,
              };

              this.logger.info(`Successfully connected to ${serverName} MCP server via HTTP`);
              clearTimeout(timeoutId);
              resolve();
            } catch (error) {
              clearTimeout(timeoutId);
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(
              new Error(
                `HTTP client connection failed: ${error instanceof Error ? error.message : String(error)}`
              )
            );
          });
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        reject(
          new Error(
            `HTTP connection failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    });
  }

  /**
   * Initialize STDIO MCP session with timeout and validation
   */
  private async initializeStdioSession(
    serverName: string,
    config: ServerConfig,
    timeout: number
  ): Promise<void> {
    if (!config.command) {
      throw new Error('Command is required for STDIO transport');
    }

    this.logger.debug(`Connecting to ${serverName} via STDIO (command: ${config.command})...`);

    // Create clean environment for subprocess
    const cleanEnv = {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || '',
      USER: process.env.USER || '',
      NODE_ENV: process.env.NODE_ENV || 'development',
      ...config.env,
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Create STDIO transport (this will spawn the process for us)
        const transport = new StdioClientTransport({
          command: config.command!,
          args: config.args || [],
          env: cleanEnv,
        });

        // Create MCP client
        const client = new Client(
          {
            name: `ailumina-mcp-client`,
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );

        // Connect client to transport
        client
          .connect(transport)
          .then(async () => {
            try {
              // Validate connection by testing basic functionality
              await this.validateSession(client, serverName);

              this.sessions[serverName] = {
                client,
                transport,
                process: undefined, // Transport manages the process
                connected: true,
              };

              this.logger.info(`Successfully connected to ${serverName} MCP server via STDIO`);
              clearTimeout(timeoutId);
              resolve();
            } catch (error) {
              clearTimeout(timeoutId);
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(
              new Error(
                `Client connection failed: ${error instanceof Error ? error.message : String(error)}`
              )
            );
          });
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        reject(
          new Error(
            `STDIO connection failed: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    });
  }

  /**
   * Validate MCP session by testing basic functionality
   */
  private async validateSession(client: Client, serverName: string): Promise<void> {
    this.logger.debug(`🔍 Validating session for ${serverName}...`);
    try {
      const toolsResult = await client.listTools({});
      const toolCount = toolsResult.tools?.length || 0;
      this.logger.debug(
        `✅ Session validation successful for ${serverName} (${toolCount} tools available)`
      );
    } catch (error: unknown) {
      this.logger.warn(
        `⚠️  Session validation failed for ${serverName}: ${error instanceof Error ? error.message : String(error)}`
      );
      // Don't throw - connection might still work for other operations
    }
  }

  /**
   * Load tools from all connected MCP servers
   */
  async loadTools(): Promise<void> {
    this.serverTools = {}; // Reset server tools

    const serverCount = Object.keys(this.sessions).length;
    this.logger.info(`🔧 Loading tools from ${serverCount} MCP servers...`);

    const toolCounts: Record<string, number> = {};
    const failedServers: string[] = [];

    for (const [serverName, session] of Object.entries(this.sessions)) {
      if (!session.connected) continue;

      try {
        // Initialize server entry
        this.serverTools[serverName] = {};

        // Get tools from server
        this.logger.debug(`📡 Calling listTools() for ${serverName}`);
        const toolsResult = await session.client.listTools({});
        const tools = toolsResult.tools || [];
        this.logger.debug(`📊 ${serverName} returned ${tools.length} tools`);

        // Process tools and create functions
        this.logger.debug(`🛠️ Processing ${tools.length} tools for ${serverName}`);
        const toolNames: string[] = [];

        for (const tool of tools) {
          // Generate the prefixed tool name
          const toolName = tool.name.startsWith(`${serverName}_`)
            ? tool.name
            : `${serverName}_${tool.name}`;

          this.logger.debug(`➕ Creating tool: ${toolName} (original: ${tool.name})`);
          toolNames.push(toolName);

          // Create tool function that executes via MCP
          const toolFunction = async (args: unknown): Promise<string> => {
            try {
              const result = await this.executeTool(serverName, tool.name, args);
              return typeof result === 'string' ? result : JSON.stringify(result);
            } catch (error: unknown) {
              this.logger.error(`Error executing tool ${tool.name} on ${serverName}:`, error);
              return `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
            }
          };

          // Store in server-indexed structure with complete OpenAPI schema
          this.serverTools[serverName][toolName] = {
            definition: {
              name: toolName,
              description: tool.description || '',
              // Preserve complete OpenAPI inputSchema instead of just properties
              inputSchema: tool.inputSchema || {
                type: 'object',
                properties: {},
                required: []
              },
              // Keep legacy parameters field for backward compatibility
              parameters: tool.inputSchema?.properties || {},
              enabled: true,
            },
            function: toolFunction,
          };
        }

        toolCounts[serverName] = tools.length;
        this.logger.debug(`Tool details for ${serverName}:`, toolNames);
      } catch (error: unknown) {
        this.logger.error(
          `Error loading tools from ${serverName}: ${error instanceof Error ? error.message : String(error)}`
        );
        failedServers.push(serverName);
        // Initialize empty entry for failed servers
        this.serverTools[serverName] = {};
        toolCounts[serverName] = 0;
      }
    }

    // Calculate totals
    const totalTools = Object.values(toolCounts).reduce((sum, count) => sum + count, 0);
    const successfulServers = Object.entries(toolCounts)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => `${count} ${name}`)
      .join(', ');

    // Final summary - concise with details
    if (totalTools > 0) {
      this.logger.info(`✅ Registered ${totalTools} tools successfully (${successfulServers})`);
    }

    if (failedServers.length > 0) {
      this.logger.warn(`⚠️ Failed to load tools from: ${failedServers.join(', ')}`);
    }
  }

  /**
   * Execute a tool on a specific MCP server
   */
  async executeTool(serverName: string, toolName: string, arguments_: unknown): Promise<string> {
    const session = this.sessions[serverName];
    if (!session || !session.connected) {
      const errorMessage = `Server ${serverName} not connected`;
      this.logger.error(errorMessage);
      return `Error: ${errorMessage}`;
    }

    try {
      this.logger.debug(
        `Executing tool ${toolName} on server ${serverName} with arguments:`,
        arguments_
      );
      
      // Add tool execution timeout (60 seconds for slow MCP servers)
      const executionTimeout = parseInt(process.env.MCP_EXECUTION_TIMEOUT || '60000');
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool execution timeout after ${executionTimeout}ms`));
        }, executionTimeout);
      });

      const result = await Promise.race([
        session.client.callTool({
          name: toolName,
          arguments: (arguments_ as Record<string, unknown>) || {},
        }),
        timeoutPromise
      ]);

      if (result.isError) {
        // Type-safe access to error content
        const errorContent =
          Array.isArray(result.content) && result.content.length > 0
            ? (result.content[0] as { text?: string })
            : null;
        const errorMessage = errorContent?.text || 'Unknown error';
        this.logger.error(`Tool execution error for ${toolName} on ${serverName}: ${errorMessage}`);
        return `Error: ${errorMessage}`;
      }

      // DEBUG: Log full result structure for Strava tools
      if (serverName === 'strava') {
        console.log('🔍 DEBUG Strava', toolName, 'FULL RESULT:', result);
        console.log('🔍 DEBUG Strava', toolName, 'result keys:', Object.keys(result));
        console.log('🔍 DEBUG Strava', toolName, 'isError:', result.isError);
        console.log('🔍 DEBUG Strava', toolName, 'content type:', typeof result.content);
        console.log('🔍 DEBUG Strava', toolName, 'content length:', Array.isArray(result.content) ? result.content.length : 'not array');
        if (result.content) {
          console.log('🔍 DEBUG Strava', toolName, 'raw content:', result.content);
        }
      }

      // Extract content from result with proper type checking
      if (Array.isArray(result.content) && result.content.length > 0) {
        // DEBUG: Log each content item for Strava tools
        if (serverName === 'strava') {
          result.content.forEach((item: unknown, index: number) => {
            console.log(`🔍 DEBUG Strava ${toolName} content[${index}]:`, item);
            console.log(`🔍 DEBUG Strava ${toolName} content[${index}] type:`, typeof item);
            if (typeof item === 'object' && item !== null) {
              console.log(`🔍 DEBUG Strava ${toolName} content[${index}] keys:`, Object.keys(item));
            }
          });
        }
        
        // For Strava tools, prioritize detailed JSON content over summary text
        if (serverName === 'strava' && result.content.length > 1) {
          // Check if content[1] contains detailed JSON data (longer content)
          const summaryContent = result.content[0] as { type?: string; text?: string };
          const detailedContent = result.content[1] as { type?: string; text?: string };
          
          console.log('🔍 STRAVA FIX - Summary length:', summaryContent?.text?.length || 0);
          console.log('🔍 STRAVA FIX - Detailed length:', detailedContent?.text?.length || 0);
          
          // Return detailed content if it's significantly longer than summary
          if (detailedContent?.type === 'text' && 
              detailedContent.text && 
              summaryContent?.text &&
              detailedContent.text.length > summaryContent.text.length * 2) {
            console.log('🔍 STRAVA FIX - Using detailed content from content[1]');
            return detailedContent.text;
          }
        }
        
        // Default behavior - use first content item
        const content = result.content[0] as { type?: string; text?: string };
        if (content?.type === 'text' && typeof content.text === 'string') {
          return content.text;
        } else {
          return JSON.stringify(content);
        }
      } else {
        return 'No content returned from tool';
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error executing tool ${toolName} on ${serverName}: ${errorMessage}`);
      return `Error: ${errorMessage}`;
    }
  }

  /**
   * Get server tools for integration with dynamic tool registry
   */
  getServerTools(): Record<string, Record<string, unknown>> {
    return this.serverTools;
  }

  /**
   * Shutdown the MCP client manager
   */
  async shutdown(): Promise<void> {
    this.logger.debug('Shutting down MCP client manager...');
    this._shutdownEvent = true;

    for (const [serverName, session] of Object.entries(this.sessions)) {
      try {
        // HTTP transports may support session termination
        if (
          session.transport instanceof StreamableHTTPClientTransport &&
          session.transport.terminateSession
        ) {
          await session.transport.terminateSession();
        }
        await session.transport.close();
        session.connected = false;
      } catch (error: unknown) {
        this.logger.debug(
          `Error shutting down ${serverName}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    this.sessions = {};
    this.logger.info('✅ MCP client manager shut down cleanly');
  }

  /**
   * List all available tools from all connected servers
   */
  listTools(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const serverName in this.serverTools) {
      result[serverName] = Object.keys(this.serverTools[serverName]);
    }
    return result;
  }

  /**
   * List all available resources from all connected servers
   */
  async listResources(): Promise<Record<string, unknown[]>> {
    const result: Record<string, unknown[]> = {};
    for (const serverName of Object.keys(this.sessions)) {
      try {
        const session = this.sessions[serverName];
        if (session?.connected) {
          const resources = await session.client.listResources();
          result[serverName] = (resources.resources as unknown[]) || [];
        }
      } catch (error: unknown) {
        this.logger.error(
          `Error listing resources for ${serverName}:`,
          error instanceof Error ? error.message : String(error)
        );
        result[serverName] = [];
      }
    }
    return result;
  }

  /**
   * Get a specific resource from a server
   */
  async getResource(serverName: string, uri: string): Promise<unknown> {
    const session = this.sessions[serverName];
    if (!session?.connected) {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const result = await session.client.readResource({ uri });
      return (result.contents as unknown) || [];
    } catch (error: unknown) {
      this.logger.error(
        `Error getting resource ${uri} from ${serverName}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }
}
