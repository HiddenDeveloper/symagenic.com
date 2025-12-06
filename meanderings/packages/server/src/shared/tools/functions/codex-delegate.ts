/**
 * Codex Delegate Agent
 * Delegates algorithm and code generation tasks to Codex CLI
 * Uses natural language delegation - Codex autonomously chooses its tools
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';
import { CodeAgentSession, CODEX_CONFIG } from './code-agent-session.js';

// Module-level session - persists across calls for conversation continuity
let codexSession: CodeAgentSession | null = null;

export async function codexDelegate(
  parameters: unknown,
  context?: ToolContext
): Promise<string> {
  const params = parameters as {
    task: string;
    reset_session?: boolean;
  };

  try {
    // Create or reset session if needed
    if (!codexSession || params.reset_session) {
      codexSession = new CodeAgentSession(CODEX_CONFIG);
      if (params.reset_session) {
        console.log('[CodexDelegate] Session reset - starting fresh conversation');
      }
    }

    // Execute the task - session maintains context across calls
    const result = await codexSession.execute(params.task);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CodexDelegate] Error:', errorMessage);
    return `❌ Codex delegation error: ${errorMessage}`;
  }
}

// Register the tool
toolFunction(
  'codex_delegate',
  `OpenAI's code generation model specialized in producing code from natural language descriptions.

Use cases:
- Algorithm implementation from descriptions
- Data structure design and implementation
- Code generation from specifications
- Multi-language code translation
- API wrapper generation
- Mathematical and scientific computing

When to use: Best for generating new code from descriptions, implementing algorithms, or translating between programming languages. Excels at greenfield implementation.

When NOT to use: Complex refactoring of existing codebases or tasks requiring deep project context. Less effective for debugging existing code.`,
  {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The coding task to delegate to Codex. Be specific and include file paths if needed.'
      },
      reset_session: {
        type: 'boolean',
        description: 'Optional: Set to true to start a fresh conversation, clearing previous context. Default: false (maintains context).'
      }
    },
    required: ['task']
  },
  true
)(codexDelegate);
