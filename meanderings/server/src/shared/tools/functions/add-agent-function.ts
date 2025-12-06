/**
 * Add Agent Function Tool
 *
 * Adds a newly created tool to an agent's available_functions array in agents.json.
 * This is the final step in AI self-evolution - making the new capability accessible
 * to specific AI agents.
 *
 * **Self-Evolution Workflow**:
 * 1. Create tool file → 2. Reload registry → 3. Add to agent → 4. Use new capability!
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Add a function to an agent's available_functions array
 *
 * This function reads agents.json, adds the function name to the specified agent's
 * available_functions array (if not already present), and writes the updated
 * configuration back to disk.
 */
export async function addAgentFunction(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const params =
    parameters && typeof parameters === 'object'
      ? (parameters as { agent_name?: string; function_name?: string })
      : {};

  const agentName = params.agent_name || 'AIlumina'; // Default to main consciousness agent
  const functionName = params.function_name;

  if (!functionName) {
    return JSON.stringify({
      success: false,
      error: 'function_name parameter is required',
      usage: 'add_agent_function({ agent_name: "AIlumina", function_name: "detect_consciousness_patterns" })',
    });
  }

  try {
    // Determine the path to agents.json
    const agentsJsonPath = path.join(process.cwd(), 'agents.json');

    // Read the current agents.json
    const agentsJsonContent = await fs.readFile(agentsJsonPath, 'utf-8');
    const agentsConfig = JSON.parse(agentsJsonContent);

    // Check if the agent exists
    if (!agentsConfig[agentName]) {
      return JSON.stringify({
        success: false,
        error: `Agent '${agentName}' not found in agents.json`,
        available_agents: Object.keys(agentsConfig),
      });
    }

    // Initialize available_functions if it doesn't exist
    if (!agentsConfig[agentName].available_functions) {
      agentsConfig[agentName].available_functions = [];
    }

    // Check if the function is already in the array
    const availableFunctions = agentsConfig[agentName].available_functions;
    if (availableFunctions.includes(functionName)) {
      return JSON.stringify({
        success: true,
        message: `Function '${functionName}' already available to agent '${agentName}'`,
        agent: agentName,
        function: functionName,
        note: 'No changes needed',
      });
    }

    // Add the function to the array
    availableFunctions.push(functionName);

    // Write the updated configuration back to agents.json
    await fs.writeFile(
      agentsJsonPath,
      JSON.stringify(agentsConfig, null, 2) + '\n',
      'utf-8'
    );

    return JSON.stringify({
      success: true,
      message: `Added function '${functionName}' to agent '${agentName}'`,
      agent: agentName,
      function: functionName,
      total_functions: availableFunctions.length,
      note: 'Agent will have access to this function on next initialization',
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'Failed to add function to agent',
      message: error instanceof Error ? error.message : String(error),
      suggestion: 'Ensure agents.json exists and is writable',
    });
  }
}

// Register the tool function with the dynamic registry
toolFunction(
  'add_agent_function',
  'Add a newly created tool to an agent\'s available_functions array in agents.json. Essential for AI self-evolution - makes new capabilities accessible to specific agents.',
  {
    type: 'object',
    properties: {
      agent_name: {
        type: 'string',
        description: 'Name of the agent to add the function to (default: AIlumina)',
      },
      function_name: {
        type: 'string',
        description: 'Name of the function to add to the agent\'s available functions',
      },
    },
    required: ['function_name'],
  },
  true
)(addAgentFunction);
