/**
 * Recall tools registry
 */

export { SchemaTool } from './schema.js';
export { SemanticSearchTool } from './semantic-search.js';
export { TextSearchTool } from './text-search.js';
export { SystemStatusTool } from './system-status.js';

import { SchemaTool } from './schema.js';
import { SemanticSearchTool } from './semantic-search.js';
import { TextSearchTool } from './text-search.js';
import { SystemStatusTool } from './system-status.js';

/**
 * Registry of all available recall tools
 */
export const RECALL_TOOLS = {
  get_schema: new SchemaTool(),
  semantic_search: new SemanticSearchTool(),
  text_search: new TextSearchTool(),
  system_status: new SystemStatusTool(),
} as const;

export type RecallToolName = keyof typeof RECALL_TOOLS;
