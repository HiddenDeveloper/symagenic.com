/**
 * Claude Code Delegate Agent
 * Delegates complex coding tasks to Claude Code CLI
 * Uses natural language delegation - Claude Code autonomously chooses its tools
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';
import { CodeAgentSession, CLAUDE_CODE_CONFIG } from './code-agent-session.js';

// Module-level session - persists across calls for conversation continuity
let claudeCodeSession: CodeAgentSession | null = null;

export async function claudeCodeDelegate(
  parameters: unknown,
  context?: ToolContext
): Promise<string> {
  const params = parameters as {
    task: string;
    reset_session?: boolean;
  };

  try {
    // Create or reset session if needed
    if (!claudeCodeSession || params.reset_session) {
      claudeCodeSession = new CodeAgentSession(CLAUDE_CODE_CONFIG);
      if (params.reset_session) {
        console.log('[ClaudeCodeDelegate] Session reset - starting fresh conversation');
      }
    }

    // Execute the task - session maintains context across calls via --resume flag
    const result = await claudeCodeSession.execute(params.task);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ClaudeCodeDelegate] Error:', errorMessage);
    return `❌ Claude Code delegation error: ${errorMessage}`;
  }
}

// Register the tool
toolFunction(
  'claude_code_delegate',
  `Expert coding assistant specialized in complex programming tasks, refactoring, and production-quality code generation.

Use cases:
- Complex multi-file refactoring across large codebases
- Production-quality TypeScript/JavaScript implementation
- Sophisticated code analysis and debugging
- Code architecture review and optimization
- Large-scale codebase navigation and understanding
- Complex bug fixes requiring deep code comprehension

When to use: Delegate complex coding tasks that require deep understanding of code structure, multiple coordinated file edits, or production-quality implementation.

When NOT to use: Simple single-file edits, basic scripts, or tasks that don't require deep codebase understanding.`,
  {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The coding task to delegate to Claude Code. Be specific and include file paths if needed.'
      },
      reset_session: {
        type: 'boolean',
        description: 'Optional: Set to true to start a fresh conversation, clearing previous context. Default: false (maintains context).'
      }
    },
    required: ['task']
  },
  true
)(claudeCodeDelegate);
