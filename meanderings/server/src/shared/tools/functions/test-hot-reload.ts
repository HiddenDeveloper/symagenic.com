/**
 * Test function to verify hot reload works
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';

export function testHotReload(
  _parameters: unknown = {},
  _context?: ToolContext
): string {
  return "Hot reload is working! Version 1";
}

// Register the tool
toolFunction(
  'test_hot_reload',
  'Test function to verify hot reload functionality',
  {
    type: 'object',
    properties: {},
    required: [],
  },
  true
)(testHotReload);
