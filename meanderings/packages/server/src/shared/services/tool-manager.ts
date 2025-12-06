/**
 * Tool Manager Service
 *
 * Handles autonomous tool upload, validation, and deployment for AI self-evolution.
 * Enables AI to extend its own capabilities without human file system intervention.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { exec } from 'child_process';
import { promisify } from 'util';
import winston from 'winston';

const execAsync = promisify(exec);

export interface ToolUploadResult {
  success: boolean;
  toolName?: string;
  message: string;
  validationResults?: {
    syntaxValid: boolean;
    hasDecorator: boolean;
    testsRun: boolean;
    testsPassed: boolean;
  };
  error?: string;
}

export class ToolManager {
  private logger: winston.Logger;
  private toolsDir: string;
  private tempDir: string;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.toolsDir = path.join(process.cwd(), 'src/shared/tools/functions');
    this.tempDir = path.join(process.cwd(), 'temp/tool-uploads');
  }

  /**
   * Upload and process a tool zip file
   * Validates, extracts, optionally runs tests, and moves to functions directory
   */
  async uploadTool(zipBuffer: Buffer, runTests: boolean = true): Promise<ToolUploadResult> {
    const uploadId = Date.now().toString();
    const extractPath = path.join(this.tempDir, uploadId);

    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(extractPath, { recursive: true });

      this.logger.info(`📦 Processing tool upload ${uploadId}`);

      // Extract zip
      const zip = new AdmZip(zipBuffer);
      zip.extractAllTo(extractPath, true);

      // Find .ts files
      const files = await fs.readdir(extractPath);
      const tsFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

      if (tsFiles.length === 0) {
        return {
          success: false,
          message: 'No TypeScript tool files found in zip',
          error: 'Zip must contain at least one .ts file with @toolFunction decorator',
        };
      }

      if (tsFiles.length > 1) {
        return {
          success: false,
          message: 'Multiple tool files found in zip',
          error: 'Zip should contain exactly one tool .ts file (tests can be in .test.ts)',
        };
      }

      const toolFile = tsFiles[0];
      const toolName = path.basename(toolFile, '.ts');
      const toolPath = path.join(extractPath, toolFile);

      this.logger.info(`🔍 Validating tool: ${toolName}`);

      // Validate syntax and decorator
      const validationResults = await this.validateTool(toolPath);

      if (!validationResults.syntaxValid) {
        return {
          success: false,
          toolName,
          message: 'TypeScript syntax validation failed',
          validationResults,
          error: 'Tool file contains syntax errors',
        };
      }

      if (!validationResults.hasDecorator) {
        return {
          success: false,
          toolName,
          message: 'Tool missing @toolFunction decorator',
          validationResults,
          error: 'Tool must use @toolFunction decorator for registration',
        };
      }

      // Run tests if requested and test file exists
      const testFile = `${toolName}.test.ts`;
      const testPath = path.join(extractPath, testFile);

      if (runTests && files.includes(testFile)) {
        this.logger.info(`🧪 Running tests for ${toolName}`);
        const testResults = await this.runTests(testPath);
        validationResults.testsRun = true;
        validationResults.testsPassed = testResults;

        if (!testResults) {
          return {
            success: false,
            toolName,
            message: 'Tool tests failed',
            validationResults,
            error: 'Fix test failures before deploying tool',
          };
        }
      }

      // Move tool to functions directory
      const destPath = path.join(this.toolsDir, toolFile);

      // Check if tool already exists
      try {
        await fs.access(destPath);
        this.logger.warn(`⚠️  Tool ${toolName} already exists, will overwrite`);
      } catch {
        // File doesn't exist, which is fine
      }

      await fs.copyFile(toolPath, destPath);

      this.logger.info(`✅ Tool ${toolName} deployed successfully`);

      // Cleanup temp directory
      await fs.rm(extractPath, { recursive: true, force: true });

      return {
        success: true,
        toolName,
        message: `Tool ${toolName} uploaded and validated successfully`,
        validationResults,
      };

    } catch (error: unknown) {
      this.logger.error('Tool upload failed:', error);

      // Cleanup on error
      try {
        await fs.rm(extractPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        message: 'Tool upload processing failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate tool TypeScript syntax and decorator presence
   */
  private async validateTool(toolPath: string): Promise<{
    syntaxValid: boolean;
    hasDecorator: boolean;
    testsRun: boolean;
    testsPassed: boolean;
  }> {
    const results = {
      syntaxValid: false,
      hasDecorator: false,
      testsRun: false,
      testsPassed: false,
    };

    try {
      // Read tool file
      const content = await fs.readFile(toolPath, 'utf-8');

      // Check for @toolFunction decorator
      results.hasDecorator = content.includes('@toolFunction') ||
                             content.includes('toolFunction(');

      // Try to compile TypeScript
      try {
        const { stdout, stderr } = await execAsync(
          `npx tsc --noEmit --target ES2020 --module ESNext --moduleResolution node ${toolPath}`,
          { cwd: process.cwd() }
        );

        // If no errors, syntax is valid
        results.syntaxValid = !stderr || stderr.length === 0;

        if (stderr) {
          this.logger.warn(`TypeScript warnings: ${stderr}`);
        }
      } catch (error: any) {
        // tsc exits with error code if compilation fails
        this.logger.error(`TypeScript compilation failed: ${error.stderr || error.message}`);
        results.syntaxValid = false;
      }

    } catch (error: unknown) {
      this.logger.error('Tool validation error:', error);
    }

    return results;
  }

  /**
   * Run tool tests if test file is provided
   */
  private async runTests(testPath: string): Promise<boolean> {
    try {
      // Use tsx to run TypeScript tests directly
      const { stdout, stderr } = await execAsync(
        `npx tsx ${testPath}`,
        { cwd: process.cwd() }
      );

      this.logger.info(`Test output: ${stdout}`);

      if (stderr && !stderr.includes('ExperimentalWarning')) {
        this.logger.warn(`Test warnings: ${stderr}`);
      }

      // If we got here without throwing, tests passed
      return true;

    } catch (error: any) {
      this.logger.error(`Tests failed: ${error.stderr || error.message}`);
      return false;
    }
  }

  /**
   * Delete a tool from the functions directory
   */
  async deleteTool(toolName: string): Promise<{ success: boolean; message: string }> {
    try {
      const toolPath = path.join(this.toolsDir, `${toolName}.ts`);

      // Check if tool exists
      try {
        await fs.access(toolPath);
      } catch {
        return {
          success: false,
          message: `Tool ${toolName} not found`,
        };
      }

      // Delete the tool file
      await fs.unlink(toolPath);

      this.logger.info(`🗑️  Deleted tool: ${toolName}`);

      return {
        success: true,
        message: `Tool ${toolName} deleted successfully`,
      };

    } catch (error: unknown) {
      this.logger.error('Tool deletion failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Tool deletion failed',
      };
    }
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.toolsDir);
      return files
        .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
        .map(f => path.basename(f, '.ts'));
    } catch (error: unknown) {
      this.logger.error('Failed to list tools:', error);
      return [];
    }
  }

  /**
   * Get tool details
   */
  async getToolDetails(toolName: string): Promise<{
    exists: boolean;
    path?: string;
    size?: number;
    modified?: Date;
  }> {
    try {
      const toolPath = path.join(this.toolsDir, `${toolName}.ts`);
      const stats = await fs.stat(toolPath);

      return {
        exists: true,
        path: toolPath,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch {
      return { exists: false };
    }
  }
}
