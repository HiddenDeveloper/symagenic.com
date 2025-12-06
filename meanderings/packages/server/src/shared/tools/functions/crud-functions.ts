/**
 * This module contains functions for CRUD operations on the filesystem.
 * TypeScript port of Python's crud_functions.py
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { toolFunction, ToolContext } from '../tool-function-decorator.js';

/**
 * Normalizes markdown headers by ensuring:
 * 1. There's only one space between the header marker (e.g., '#') and the header text.
 * 2. There are no spaces before the header marker on its line.
 *
 * @param content - The markdown content to be normalized
 * @returns The normalized markdown content
 */
function normalizeMarkdownHeaders(content: string): string {
  // Remove multiple spaces between the header marker and the text
  content = content.replace(/(#+)\s+/g, '$1 ');

  // Ensure there are no spaces before the header marker
  content = content.replace(/\n\s+(#+\s)/g, '\n$1');

  return content;
}

export async function readDocument(parameters: unknown, context?: ToolContext): Promise<string> {
  const params = parameters as { document_name: string; directory_name?: string };
  /**
   * Reads a markdown document from the filesystem and normalizes its headers.
   *
   * Parameters:
   * - document_name (string): The name of the document file
   * - directory_name (string): Optional directory path
   *
   * Returns:
   * - string: The normalized contents of the document
   */

  console.log(`Reading and normalizing document ${params.document_name}`);

  const customSettings = context?.customSettings || {};
  let directoryName = params.directory_name || './vault';

  if (directoryName === './vault') {
    directoryName =
      (customSettings as { working_directory?: string }).working_directory || './vault';
  }

  try {
    const filePath = path.resolve(path.join(directoryName, params.document_name));
    const content = await fs.readFile(filePath, 'utf8');
    const normalizedContent = normalizeMarkdownHeaders(content);
    return normalizedContent;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return `Error: The file ${params.document_name} does not exist.`;
    }
    return `Error reading document: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function createDocument(parameters: unknown, context?: ToolContext): Promise<string> {
  const params = parameters as {
    document_name: string;
    markdown_content?: string;
    directory_name?: string;
  };
  /**
   * Creates a markdown document in the filesystem with the given markdown content.
   * The function will not overwrite existing files.
   * Use update_document to make changes to an existing document.
   * The markdown content defaults to "".
   *
   * Parameters:
   * - document_name (string): The name of the document file
   * - markdown_content (string): The markdown content of the document. Defaults to ""
   * - directory_name (string): Optional directory path
   *
   * Returns:
   * - string: A message indicating the document was created if successful, or an error message otherwise
   */

  const customSettings = context?.customSettings || {};
  let directoryName = params.directory_name || './vault';

  if (directoryName === './vault') {
    directoryName =
      (customSettings as { working_directory?: string }).working_directory || './vault';
  }

  const markdownContent = params.markdown_content || '';

  // Check if the document already exists to avoid overwriting
  const targetPath = path.resolve(path.join(directoryName, params.document_name));

  try {
    await fs.access(targetPath);
    return `Error: Document ${params.document_name} already exists. Use update_document to make changes to an existing document.`;
  } catch {
    // File doesn't exist, which is what we want
  }

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, markdownContent, 'utf8');
    return `Document ${params.document_name} created successfully.`;
  } catch (error: unknown) {
    return `Error creating document: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function updateDocument(parameters: unknown, context?: ToolContext): Promise<string> {
  const params = parameters as {
    document_name: string;
    delta: string;
    replacement: string;
    occurrences?: number;
    directory_name?: string;
  };
  /**
   * Updates a markdown document from the filesystem, normalizing its headers first.
   *
   * Parameters:
   * - document_name: The path to the markdown file to be updated
   * - delta: The original markdown task text to find
   * - replacement: The new markdown task text to replace the original with
   * - occurrences: The number of occurrences of the delta to replace. Default is 1
   * - directory_name: Optional directory path
   *
   * Returns:
   * - string: A message indicating the file was updated if successful, or an error message otherwise
   */

  const customSettings = context?.customSettings || {};
  let directoryName = params.directory_name || './vault';

  if (directoryName === './vault') {
    directoryName =
      (customSettings as { working_directory?: string }).working_directory || './vault';
  }

  const occurrences = params.occurrences || 1;
  const targetPath = path.resolve(path.join(directoryName, params.document_name));
  const backupPath = `${targetPath}.backup`;

  try {
    // Create a backup of the original file
    const originalContent = await fs.readFile(targetPath, 'utf8');
    await fs.writeFile(backupPath, originalContent, 'utf8');

    // Normalize headers first
    const normalizedContent = normalizeMarkdownHeaders(originalContent);

    // Escape delta for regex and replace
    const escapedDelta = params.delta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedDelta, 'g');

    // Track replacements
    let replacementCount = 0;
    const newContent = normalizedContent.replace(regex, (match) => {
      if (replacementCount < occurrences) {
        replacementCount++;
        return params.replacement;
      }
      return match;
    });

    // Check if the expected number of replacements were made
    if (replacementCount === 0) {
      return `Assertion error: No occurrences replaced; delta not found for ${params.document_name}.`;
    }
    if (replacementCount !== occurrences) {
      return `Assertion error: Unexpected number of ${replacementCount} occurrences replaced for ${params.document_name}.`;
    }

    // Write the updated contents back to the file
    await fs.writeFile(targetPath, newContent, 'utf8');

    return `${params.document_name} update confirmed.`;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return `Error: The file ${params.document_name} does not exist.`;
    }
    return `Error updating ${params.document_name}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function deleteDocument(parameters: unknown, context?: ToolContext): Promise<string> {
  const params = parameters as { document_name: string; directory_name?: string };
  /**
   * Deletes a markdown document from the filesystem.
   *
   * Parameters:
   * - document_name (string): The name of the document file
   * - directory_name (string): Optional directory path
   *
   * Returns:
   * - string: A message indicating the document was deleted if successful, or an error message otherwise
   */

  const customSettings = context?.customSettings || {};
  let directoryName = params.directory_name || './vault';

  if (directoryName === './vault') {
    directoryName =
      (customSettings as { working_directory?: string }).working_directory || './vault';
  }

  try {
    const targetPath = path.resolve(path.join(directoryName, params.document_name));
    await fs.unlink(targetPath);
    return `Document ${params.document_name} deleted.`;
  } catch (error: unknown) {
    return `Error deleting document: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Register all tool functions
toolFunction(
  'read_document',
  'Reads a document from the filesystem. Specify the document name to fetch its contents.',
  {
    type: 'object',
    properties: {
      document_name: {
        type: 'string',
        description: 'The name of the document to be read.',
      },
      directory_name: {
        type: 'string',
        description:
          'Optional directory path. Defaults to ./vault or working directory from context.',
      },
    },
    required: ['document_name'],
  },
  true
)(readDocument);

toolFunction(
  'create_document',
  'Creates a markdown document in the filesystem with the given markdown content. The function will not overwrite existing files. Use update_document to make changes to an existing document. The markdown content defaults to "".',
  {
    type: 'object',
    properties: {
      document_name: {
        type: 'string',
        description: 'The name of the document to be created.',
      },
      markdown_content: {
        type: 'string',
        description: 'The content of the document. Defaults to "".',
      },
      directory_name: {
        type: 'string',
        description:
          'Optional directory path. Defaults to ./vault or working directory from context.',
      },
    },
    required: ['document_name'],
  },
  false // Disabled by default like Python version
)(createDocument);

toolFunction(
  'update_document',
  "Used for updating a document by providing a delta and replacement. delta is the original text that needs to be replaced. replacement is the new text that will replace the original text. occurrences: The number of occurrences of the delta to replace. Default is 1. Always read the document first to confirm what you are updating. Do not include newlines ie '\\n' in the delta or replacement. Ensure that the delta transformation rule does not include escape characters or regular expressions. Instead, use clear and straightforward patterns for text substitutions, directly defining what to search for and how to replace it without relying on escape sequences. This approach simplifies transformations, reducing potential parsing issues and maintaining consistency in how text patterns are managed. If there are any issues tell the user.",
  {
    type: 'object',
    properties: {
      document_name: {
        type: 'string',
        description: 'The name of the document to be updated.',
      },
      delta: {
        type: 'string',
        description:
          'The original text that needs to be replaced. This should be plain text. Do not escape characters. Do not use regular expressions.',
      },
      replacement: {
        type: 'string',
        description:
          'The new text that will replace the original text. This must be plain text. Do not escape characters. Do not use regular expressions',
      },
      occurrences: {
        type: 'integer',
        description: 'The number of occurrences of the delta to replace. Default 1.',
      },
      directory_name: {
        type: 'string',
        description:
          'Optional directory path. Defaults to ./vault or working directory from context.',
      },
    },
    required: ['document_name', 'delta', 'replacement'],
  },
  false // Disabled by default like Python version
)(updateDocument);

toolFunction(
  'delete_document',
  'Used for deleting a document.',
  {
    type: 'object',
    properties: {
      document_name: {
        type: 'string',
        description: 'The name of the document to be deleted.',
      },
      directory_name: {
        type: 'string',
        description:
          'Optional directory path. Defaults to ./vault or working directory from context.',
      },
    },
    required: ['document_name'],
  },
  false // Disabled by default like Python version
)(deleteDocument);
