/**
 * Sampling request handlers for STDIO wrapper
 */

import { 
  SamplingRequest, 
  SamplingResult, 
  StdioWrapperConfig 
} from "../../shared/types.js";
import { generateCreativeResponse } from "./generators.js";

export function handleSamplingRequest(
  request: SamplingRequest,
  config: StdioWrapperConfig
): SamplingResult {
  const { messages, systemPrompt } = request;
  
  // Find the user message
  const userMessage = messages.find(msg => msg.role === "user");
  if (!userMessage) {
    throw new Error("No user message found in sampling request");
  }
  
  const prompt = userMessage.content.text;
  console.error(`🎯 Handling sampling request: "${prompt}"`);
  
  // Generate creative response
  let responseText = generateCreativeResponse(prompt);
  
  // Add system prompt context if provided
  if (systemPrompt) {
    responseText += `\n\n[Context: ${systemPrompt}]`;
  }
  
  console.error(`✅ Generated sampling response`);
  
  return {
    role: "assistant",
    content: {
      type: "text",
      text: responseText,
    },
    model: "mcp-stdio-wrapper-with-sampling",
    stopReason: "endTurn",
  };
}

export function shouldTriggerSampling(
  toolName: string, 
  result: any, 
  config: StdioWrapperConfig
): boolean {
  // Only trigger sampling for calculator tool with results above threshold
  if (!config.enableSampling || toolName !== "calculate") {
    return false;
  }
  
  // Extract result from tool response
  if (result?.content?.[0]?.text) {
    const text = result.content[0].text;
    const resultMatch = text.match(/= (\d+(?:\.\d+)?)/);
    if (resultMatch) {
      const numericResult = parseFloat(resultMatch[1]);
      return numericResult > config.samplingThreshold;
    }
  }
  
  return false;
}