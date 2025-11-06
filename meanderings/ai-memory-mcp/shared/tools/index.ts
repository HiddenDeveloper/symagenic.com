/**
 * Memory tools registry
 */

export { SchemaTool } from './schema.js';
export { SemanticSearchTool } from './semantic-search.js';
export { CypherQueryTool } from './cypher-query.js';
export { SystemStatusTool } from './system-status.js';
export { TextSearchTool } from './text-search.js';
export { LoadCurrentFocusTool } from './load-current-focus.js';

import { SchemaTool } from './schema.js';
import { SemanticSearchTool } from './semantic-search.js';
import { CypherQueryTool } from './cypher-query.js';
import { SystemStatusTool } from './system-status.js';
import { TextSearchTool } from './text-search.js';
import { LoadCurrentFocusTool } from './load-current-focus.js';

/**
 * Registry of all available memory tools
 */
export const MEMORY_TOOLS = {
  get_schema: new SchemaTool(),
  semantic_search: new SemanticSearchTool(),
  text_search: new TextSearchTool(),
  execute_cypher: new CypherQueryTool(),
  system_status: new SystemStatusTool(),
  load_current_focus: new LoadCurrentFocusTool(),
} as const;

export type MemoryToolName = keyof typeof MEMORY_TOOLS;