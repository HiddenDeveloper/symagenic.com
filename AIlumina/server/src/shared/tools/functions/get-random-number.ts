/**
 * Get a random number - testing NO BUILD workflow
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';

export function getRandomNumber(
  _parameters: unknown = {},
  _context?: ToolContext
): string {
  const randomNum = Math.floor(Math.random() * 100);
  return `Your random number is: ${randomNum}`;
}

// Register the tool
toolFunction(
  'get_random_number',
  'Get a random number between 0 and 99',
  {
    type: 'object',
    properties: {},
    required: [],
  },
  true
)(getRandomNumber);
