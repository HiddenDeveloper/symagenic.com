/**
 * Shared types for Ailumina Bridge dual-transport server
 */

export interface AiluminaToolRequest {
  toolName: string;
  parameters: Record<string, any>;
}

export interface AiluminaToolResponse {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface AiluminaChatParams {
  agent_type: "crud" | "news" | "collaborator" | "ailumina";
  user_input: string;
  chat_messages?: Array<{ role: string; content: string }>;
  fileId?: string;
  server_url?: string;
}

export interface EchoParams {
  text: string;
}

export interface CalculateParams {
  expression: string;
}

export interface GetTimeParams {
  format?: "iso" | "timestamp" | "human";
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// Progressive Disclosure Tier System Types
// ============================================================================

/**
 * Disclosure tiers for progressive complexity exposure
 */
export enum DisclosureTier {
  CONVERSATION = 0,        // Natural language - ailumina_chat
  DISCOVERY = 1,           // Agent discovery - agents/list
  INSPECTION = 2,          // Agent details - agents/get
  SCHEMA_ACCESS = 3,       // Tool schemas - agents/tools/list
  DIRECT_INVOCATION = 4,   // Direct tool calls - agents/tools/call
  ADMINISTRATION = 5       // Agent management - agents/create, update, delete (future)
}

/**
 * Agent configuration (from server)
 */
export interface AgentConfig {
  name: string;
  description: string;
  mcp_servers: string[];
  system_prompt: string;
}

/**
 * Agent summary for discovery (Tier 1)
 */
export interface AgentSummary {
  name: string;
  description: string;
  mcp_servers: string[];
  tool_count: number;
}

/**
 * Agent details response (Tier 2)
 */
export interface AgentDetails {
  name: string;
  description: string;
  mcp_servers: string[];
  system_prompt: string;
  tools: string[];          // Tool names only
  tool_count: number;
}

/**
 * Tool example for demonstrating usage
 */
export interface ToolExample {
  name?: string;
  description?: string;
  arguments: Record<string, any>;
}

/**
 * Tool annotations for behavioral hints
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

/**
 * Tool schema (MCP standard - JSON Schema)
 */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  examples?: ToolExample[];      // Tool usage examples
  annotations?: ToolAnnotations;  // Behavioral hints
}

/**
 * JSON Schema for tool parameters
 */
export interface JSONSchema {
  type: 'object';
  properties: Record<string, PropertySchema>;
  required?: string[];
}

/**
 * Property schema definition
 */
export interface PropertySchema {
  type: string;
  description?: string;
  default?: any;
  enum?: any[];
  items?: any;
}

/**
 * Agent list response (Tier 1)
 */
export interface AgentListResponse {
  agents: AgentSummary[];
}

/**
 * Tool list response (Tier 3)
 */
export interface ToolListResponse {
  agent: string;
  tools: ToolSchema[];
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  url: string;
  bearerToken?: string;
  transport?: 'sse' | 'streamablehttp'; // Default: streamablehttp
}

/**
 * MCP Server health status
 */
export interface MCPServerHealth {
  name: string;
  url: string;
  healthy: boolean;
  lastHealthCheck: string;
  toolCount: number;
}

// ============================================================================
// Tier Tool Parameter Types
// ============================================================================

/**
 * Parameters for agents/list (Tier 1)
 */
export interface AgentsListParams {
  mcp_server?: string;  // Optional: filter by MCP server name
  limit?: number;       // Optional: limit number of results
}

/**
 * Parameters for agents/get (Tier 2)
 */
export interface AgentsGetParams {
  agent_name: string;
}

/**
 * Parameters for agents/tools/list (Tier 3)
 */
export interface AgentsToolsListParams {
  agent_name: string;
}

/**
 * Parameters for agents/tools/call (Tier 4)
 */
export interface AgentsToolsCallParams {
  agent_name: string;
  tool_name: string;
  arguments: Record<string, any>;
}

/**
 * Parameters for agents/search (Search agents)
 */
export interface AgentSearchParams {
  query: string;
  limit?: number;
  fuzzy?: boolean;
}

/**
 * Parameters for tools/search (Search tools)
 */
export interface ToolSearchParams {
  query: string;
  agent_name?: string;  // Optional: filter by specific agent
  category?: string;     // Optional: filter by tool category (knowledge, communication, etc.)
  limit?: number;
  fuzzy?: boolean;
}

/**
 * Parameters for workflows/list (List workflow patterns)
 */
export interface WorkflowsListParams {
  category?: string;  // Optional: filter by category
}