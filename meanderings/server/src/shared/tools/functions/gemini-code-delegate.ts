/**
 * Gemini Code Delegate Agent
 * Delegates visual/UI coding tasks to Gemini CLI
 * Uses natural language delegation - Gemini autonomously chooses its tools
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';
import { CodeAgentSession, GEMINI_CONFIG } from './code-agent-session.js';

// Module-level session - persists across calls for conversation continuity
let geminiSession: CodeAgentSession | null = null;

export async function geminiCodeDelegate(
  parameters: unknown,
  context?: ToolContext
): Promise<string> {
  const params = parameters as {
    task: string;
    reset_session?: boolean;
  };

  try {
    // Create or reset session if needed
    if (!geminiSession || params.reset_session) {
      geminiSession = new CodeAgentSession(GEMINI_CONFIG);
      if (params.reset_session) {
        console.log('[GeminiCodeDelegate] Session reset - starting fresh conversation');
      }
    }

    // Execute the task - session maintains context across calls
    const result = await geminiSession.execute(params.task);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GeminiCodeDelegate] Error:', errorMessage);
    return `❌ Gemini Code delegation error: ${errorMessage}`;
  }
}

// Register the tool
toolFunction(
  'gemini_code_delegate',
  `Google's multimodal AI with coding capabilities. Can process images, diagrams, and documentation alongside code.

Use cases:
- Code generation from UI mockups or screenshots
- Implementing designs from diagrams and flowcharts
- Documentation-to-code translation
- Code understanding from visual representations
- API implementation from OpenAPI specs with diagrams

When to use: Tasks involving visual inputs like UI mockups, architecture diagrams, or when documentation includes important visual elements. Good for design-to-code workflows.

When NOT to use: Pure text-based coding tasks or when visual context isn't helpful. Other assistants may be more specialized for text-only work.`,
  {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The coding task to delegate to Gemini Code. Be specific and include file paths if needed.'
      },
      reset_session: {
        type: 'boolean',
        description: 'Optional: Set to true to start a fresh conversation, clearing previous context. Default: false (maintains context).'
      }
    },
    required: ['task']
  },
  true
)(geminiCodeDelegate);
