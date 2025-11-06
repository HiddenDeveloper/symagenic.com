/**
 * Sampling handlers for Ailumina Bridge STDIO wrapper
 */

import { generateAiluminaBridgeContent, shouldTriggerAiluminaSampling } from './generators.js';
import { AILUMINA_STDIO_CONFIG } from '../config/settings.js';

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
 * Main sampling handler for Ailumina Bridge operations
 */
export function handleAiluminaSampling(context: SamplingContext): SamplingResult {
  if (!AILUMINA_STDIO_CONFIG.sampling.enabled) {
    return { shouldSample: false };
  }

  const { toolName, parameters, result } = context;

  // Check if this operation should trigger sampling
  const shouldSample = shouldTriggerAiluminaSampling(
    toolName,
    parameters,
    result,
[...AILUMINA_STDIO_CONFIG.sampling.aiCommunicationKeywords]
  );

  if (!shouldSample) {
    return { shouldSample: false };
  }

  // Generate AI communication enhancement content
  const content = generateAiluminaBridgeContent(toolName, parameters, result);

  return {
    shouldSample: true,
    content,
    type: 'ai_bridge_communication'
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