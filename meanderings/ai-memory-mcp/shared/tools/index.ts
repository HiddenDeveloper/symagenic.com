/**
 * Memory tools registry
 */

export { SchemaTool } from './schema.js';
export { SemanticSearchTool } from './semantic-search.js';
export { CypherQueryTool } from './cypher-query.js';
export { SystemStatusTool } from './system-status.js';
export { TextSearchTool } from './text-search.js';
export { LoadCurrentFocusTool } from './load-current-focus.js';

// Workflow management tools (Anthropic-inspired)
export {
  CreateTestContractTool,
  CreateFeatureTool,
  QueryNextTaskTool,
  UpdateFeatureStateTool,
  UpdateTestStatusTool
} from './workflow-tools.js';
export { RunStartupProtocolTool } from './run-startup-protocol.js';

import { SchemaTool } from './schema.js';
import { SemanticSearchTool } from './semantic-search.js';
import { CypherQueryTool } from './cypher-query.js';
import { SystemStatusTool } from './system-status.js';
import { TextSearchTool } from './text-search.js';
import { LoadCurrentFocusTool } from './load-current-focus.js';
import {
  CreateTestContractTool,
  CreateFeatureTool,
  QueryNextTaskTool,
  UpdateFeatureStateTool,
  UpdateTestStatusTool
} from './workflow-tools.js';
import { RunStartupProtocolTool } from './run-startup-protocol.js';

/**
 * Registry of all available memory tools
 */
export const MEMORY_TOOLS = {
  // Core memory tools
  get_schema: new SchemaTool(),
  semantic_search: new SemanticSearchTool(),
  text_search: new TextSearchTool(),
  execute_cypher: new CypherQueryTool(),
  system_status: new SystemStatusTool(),
  load_current_focus: new LoadCurrentFocusTool(),

  // Workflow management tools (Anthropic + Stone Monkey hybrid)
  create_test_contract: new CreateTestContractTool(),
  create_feature: new CreateFeatureTool(),
  query_next_task: new QueryNextTaskTool(),
  update_feature_state: new UpdateFeatureStateTool(),
  update_test_status: new UpdateTestStatusTool(),
  run_startup_protocol: new RunStartupProtocolTool(),
} as const;

export type MemoryToolName = keyof typeof MEMORY_TOOLS;