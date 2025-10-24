/**
 * Upload Tool Function
 *
 * Enables AI to upload new tools via zip file, validating and deploying them autonomously.
 * Part of the self-evolution system.
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

interface UploadToolParameters {
  toolZipPath: string;
  runTests?: boolean;
}

/**
 * Upload a tool zip file for validation and deployment
 *
 * @param parameters - Upload configuration
 * @param parameters.toolZipPath - Path to the tool zip file
 * @param parameters.runTests - Whether to run tests during validation (default: true)
 * @returns Upload result with validation details
 */
export async function uploadTool(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const { toolZipPath, runTests = true } = parameters as UploadToolParameters;

  const serverUrl = process.env.SERVER_URL || 'http://localhost:8000';
  const uploadEndpoint = `${serverUrl}/api/tools`;

  try {
    // Read the zip file
    const fs = await import('fs/promises');
    const zipBuffer = await fs.readFile(toolZipPath);

    // Create form data using Bun's built-in FormData
    const formData = new FormData();
    const blob = new Blob([zipBuffer], { type: 'application/zip' });
    formData.append('tool_zip', blob, 'tool.zip');
    formData.append('run_tests', String(runTests));

    // Upload to server
    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json() as any;

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Upload failed',
        message: result.message || `HTTP ${response.status}`,
        validationResults: result.validationResults,
      }, null, 2);
    }

    return JSON.stringify({
      success: true,
      toolName: result.toolName,
      message: result.message,
      validationResults: result.validationResults,
      reload: result.reload,
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      success: false,
      error: 'Tool upload failed',
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  }
}

// Register the tool
toolFunction(
  'upload_tool',
  'Upload a tool zip file for validation and deployment. The zip must contain a .ts file with @toolFunction decorator. Optionally include .test.ts for validation.',
  {
    type: 'object',
    properties: {
      toolZipPath: {
        type: 'string',
        description: 'Path to the tool zip file to upload',
      },
      runTests: {
        type: 'boolean',
        description: 'Whether to run tests during validation (default: true)',
        default: true,
      },
    },
    required: ['toolZipPath'],
  },
  true
)(uploadTool);
