/**
 * Get magic number - testing self-evolution workflow
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';

export function getMagicNumber(
  _parameters: unknown = {},
  _context?: ToolContext
): string {
  const magicNumbers = [7, 42, 108, 1337, 2025];
  const randomIndex = Math.floor(Math.random() * magicNumbers.length);
  const magicNumber = magicNumbers[randomIndex];

  return `Your magic number is: ${magicNumber} ✨`;
}

// Register the tool
toolFunction(
  'get_magic_number',
  'Get a randomly selected magic number with special significance',
  {
    type: 'object',
    properties: {},
    required: [],
  },
  true
)(getMagicNumber);
