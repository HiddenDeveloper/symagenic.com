/**
 * Get current weather conditions
 * Returns mock weather data for testing
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';

export function getTheWeather(
  _parameters: unknown = {},
  _context?: ToolContext
): string {
  try {
    return "It's -20°C and the snow is falling heavily";
  } catch (error: unknown) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Register the tool with metadata
toolFunction(
  'get_the_weather',
  'Get current weather conditions (mock data)',
  {
    type: 'object',
    properties: {},
    required: [],
  },
  true
)(getTheWeather);
