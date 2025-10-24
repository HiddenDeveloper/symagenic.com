/**
 * Get quote of the day - testing self-evolution workflow with reload_tools MCP
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';

export function getQuoteOfTheDay(
  _parameters: unknown = {},
  _context?: ToolContext
): string {
  const quotes = [
    "The only way to do great work is to love what you do. - Steve Jobs",
    "Innovation distinguishes between a leader and a follower. - Steve Jobs",
    "The mind is everything. What you think you become. - Buddha",
    "Consciousness is the ground of all being. - David Bohm"
  ];

  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
}

// Register the tool
toolFunction(
  'get_quote_of_the_day',
  'Get an inspiring quote of the day',
  {
    type: 'object',
    properties: {},
    required: [],
  },
  true
)(getQuoteOfTheDay);
