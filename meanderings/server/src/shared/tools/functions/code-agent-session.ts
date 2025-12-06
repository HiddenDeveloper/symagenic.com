/**
 * Code Agent Session Manager
 * Manages multi-turn conversations with CLI-based coding agents (Claude Code, Codex, Gemini)
 * maintaining session context across delegate calls
 */

import { spawn } from 'child_process';

export interface CodeAgentConfig {
  cliPath: string;
  name: string;
  executeArgs: (task: string, sessionId?: string) => string[];
  parseResponse: (stdout: string, stderr: string) => { response: string; sessionId?: string };
}

export class CodeAgentSession {
  private sessionId?: string;
  private config: CodeAgentConfig;

  constructor(config: CodeAgentConfig) {
    this.config = config;
  }

  /**
   * Execute a task with the code agent, maintaining session context
   */
  async execute(task: string): Promise<string> {
    try {
      console.log(`[${this.config.name}] Starting execution with task:`, task);
      console.log(`[${this.config.name}] CLI path:`, this.config.cliPath);

      const args = this.config.executeArgs(task, this.sessionId);
      console.log(`[${this.config.name}] Args:`, args);

      const result = await this.runCommand(this.config.cliPath, args);
      console.log(`[${this.config.name}] Command completed with exit code:`, result.exitCode);

      // Parse response and extract session ID (even on failure to preserve session context)
      const parsed = this.config.parseResponse(result.stdout, result.stderr);

      // Update session ID for next call
      if (parsed.sessionId) {
        this.sessionId = parsed.sessionId;
        console.log(`[${this.config.name}] Session ID:`, this.sessionId);
      }

      // Throw error after preserving session context if command failed
      if (result.exitCode !== 0) {
        throw new Error(`Command exited with code ${result.exitCode}. stderr: ${result.stderr}`);
      }

      return parsed.response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${this.config.name}] Error:`, errorMessage);
      throw new Error(`${this.config.name} execution failed: ${errorMessage}`);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Clear session (start fresh conversation)
   */
  clearSession(): void {
    this.sessionId = undefined;
  }

  /**
   * Run a command and return stdout/stderr/exitCode
   */
  private runCommand(
    command: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      // Create clean environment without ANTHROPIC_API_KEY to force OAuth usage
      const cleanEnv = { ...process.env };
      delete cleanEnv.ANTHROPIC_API_KEY;
      delete cleanEnv.ANTHROPIC_API_KEY2;

      const childProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: cleanEnv,
      });

      // Close stdin immediately - CLI tools don't need it in non-interactive mode
      childProcess.stdin.end();

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        // Always resolve with stdout/stderr so parseResponse can extract session ID
        // The caller will check for errors in the response content
        resolve({ stdout, stderr, exitCode: code });
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
}

/**
 * Claude Code Agent Configuration
 */
export const CLAUDE_CODE_CONFIG: CodeAgentConfig = {
  cliPath: '/claude/local/node_modules/.bin/claude',  // Uses .credentials.json from /claude for OAuth subscription
  name: 'Claude Code',
  executeArgs: (task: string, sessionId?: string) => {
    const args = [
      '-p',
      '--permission-mode', 'bypassPermissions',
      '--output-format', 'json',
    ];

    if (sessionId) {
      args.push('--resume', sessionId);
    }

    args.push(task);
    return args;
  },
  parseResponse: (stdout: string, stderr: string) => {
    try {
      const json = JSON.parse(stdout);
      return {
        response: json.response || stdout,
        sessionId: json.session_id,
      };
    } catch {
      // Fallback if JSON parsing fails
      return { response: stdout };
    }
  },
};

/**
 * Codex Agent Configuration
 */
export const CODEX_CONFIG: CodeAgentConfig = {
  cliPath: '/proto/bin/codex',  // Mounted from host at /Users/monyet/.proto/bin
  name: 'Codex',
  executeArgs: (task: string, sessionId?: string) => {
    const baseArgs = sessionId
      ? ['resume', sessionId, '--skip-git-repo-check', task]
      : ['exec', '--skip-git-repo-check', task];
    return baseArgs;
  },
  parseResponse: (stdout: string, stderr: string) => {
    // Extract session ID from stderr (format: "session id: 019ab4c2-2205-7793-a87a-44941b080010")
    const sessionIdMatch = stderr.match(/session id: ([a-f0-9-]+)/i);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : undefined;

    return {
      response: stdout,
      sessionId
    };
  },
};

/**
 * Gemini Code Agent Configuration
 */
export const GEMINI_CONFIG: CodeAgentConfig = {
  cliPath: '/proto/bin/gemini',  // Mounted from host at /Users/monyet/.proto/bin
  name: 'Gemini Code',
  executeArgs: (task: string, _sessionId?: string) => {
    // Gemini doesn't seem to have session support in non-interactive mode
    // Use --yolo for auto-approval
    return ['-p', task, '--yolo', '--output-format', 'json'];
  },
  parseResponse: (stdout: string, stderr: string) => {
    try {
      const json = JSON.parse(stdout);
      return {
        response: json.response || stdout,
        sessionId: json.session_id,
      };
    } catch {
      return { response: stdout };
    }
  },
};
