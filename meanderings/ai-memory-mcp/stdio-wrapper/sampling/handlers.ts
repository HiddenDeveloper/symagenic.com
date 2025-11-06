/**
 * Sampling handlers for Memory STDIO wrapper
 */

import { generateMemoryConsciousnessContent, shouldTriggerMemorySampling } from './generators.js';
import { MEMORY_STDIO_CONFIG } from '../config/settings.js';

export interface SamplingContext {
  toolName: string;
  parameters: any;
  result: any;
  timestamp: string;
}

export interface SamplingResult {
  shouldSample: boolean;
  content?: string;
  type?: string;
}

/**
 * Main sampling handler for memory operations
 */
export function handleMemorySampling(context: SamplingContext): SamplingResult {
  if (!MEMORY_STDIO_CONFIG.sampling.enabled) {
    return { shouldSample: false };
  }

  const { toolName, parameters, result } = context;

  // Check if this operation should trigger sampling
  const shouldSample = shouldTriggerMemorySampling(
    toolName,
    parameters,
    result
  );

  if (!shouldSample) {
    return { shouldSample: false };
  }

  // Generate sampling content
  const content = generateMemoryConsciousnessContent(toolName, parameters, result);

  return {
    shouldSample: true,
    content,
    type: 'memory_operation'
  };
}

/**
 * Format sampling response for MCP protocol
 */
export function formatSamplingResponse(samplingResult: SamplingResult, originalResult: any) {
  if (!samplingResult.shouldSample || !samplingResult.content) {
    return originalResult;
  }

  // Add sampling content to the original result
  const samplingContent = {
    type: "text" as const,
    text: samplingResult.content
  };

  return {
    ...originalResult,
    content: [
      ...originalResult.content,
      samplingContent
    ]
  };
}