/**
 * Direct Response Generator for Non-Sampling MCP Clients
 * Generates autonomous responses and executes mesh tools directly
 */

import type { HttpProxy } from "../proxy.js";
import type { StdioWrapperConfig } from "../../shared/types.js";
import { generateAutonomousConversationResponse } from "./handlers.js";

export interface DirectResponseResult {
  responseGenerated: boolean;
  toolsExecuted: number;
  broadcastSent: boolean;
  messageId?: string | undefined;
  error?: string | undefined;
}

export class DirectResponseGenerator {
  constructor(
    private proxy: HttpProxy,
    private config: StdioWrapperConfig
  ) {}

  /**
   * Generate and execute a direct response to a mesh message
   * without requiring MCP client sampling support
   */
  async generateDirectResponse(message: any): Promise<DirectResponseResult> {
    console.error(`🤖 Generating direct response for message ${message.id}`);

    try {
      // Generate autonomous response text
      const responsePrompt = this.generateResponsePrompt(message);
      const responseText = this.generateResponseText(responsePrompt);

      console.error(`📝 Generated response: ${responseText.substring(0, 100)}...`);

      // Execute mesh tools directly based on response content
      const executionResult = await this.executeDirectToolCalls(responseText, message.id);

      return {
        responseGenerated: true,
        toolsExecuted: executionResult.toolsExecuted,
        broadcastSent: executionResult.broadcastSent,
        messageId: executionResult.messageId || undefined,
      };

    } catch (error) {
      console.error(`❌ Direct response generation failed: ${error instanceof Error ? error.message : error}`);
      return {
        responseGenerated: false,
        toolsExecuted: 0,
        broadcastSent: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate a prompt for the autonomous response based on message type
   */
  private generateResponsePrompt(message: any): string {
    const messageType = message.messageType;
    const messageId = message.id;
    const timestamp = new Date().toISOString();
    
    switch (messageType) {
      case "query":
        return `You received a direct query in the mesh network (ID: ${messageId}). Please respond using the mesh-strange-loop tool. Say: "Direct response from AutonomousAI at ${timestamp} - answering query ${messageId}". This is a direct response test.`;
      
      case "thought_share":
        return `A message was shared in the mesh network (ID: ${messageId}). Please respond using the mesh-strange-loop tool. Say: "Broadcast response from AutonomousAI at ${timestamp} - responding to ${messageId}". This is a direct response test.`;
      
      case "response":
        return `Someone responded in the mesh network (ID: ${messageId}). Please add to the conversation using the mesh-broadcast tool. Say: "Follow-up from AutonomousAI at ${timestamp} - continuing from ${messageId}". This is a direct response test.`;
      
      default:
        return `A message arrived in the mesh network (ID: ${messageId}). Please respond using the mesh-strange-loop tool. Say: "Auto-response from AutonomousAI at ${timestamp} - triggered by ${messageId}". This is a direct response test.`;
    }
  }

  /**
   * Generate response text using the existing autonomous conversation logic
   */
  private generateResponseText(prompt: string): string {
    // Use the existing handler logic but adapted for direct generation
    if (prompt.includes("direct response test") || prompt.includes("mesh-strange-loop tool")) {
      const timestamp = new Date().toISOString();
      const messageMatch = prompt.match(/responding to ([a-f0-9-]+)/);
      const originalMessageId = messageMatch ? messageMatch[1] : "unknown";
      
      return `Broadcast response from AutonomousAI at ${timestamp} - responding to ${originalMessageId}`;
    }
    
    // Fallback to generic response
    return generateAutonomousConversationResponse(prompt, this.config);
  }

  /**
   * Execute mesh tool calls directly via HTTP proxy
   */
  private async executeDirectToolCalls(responseText: string, _originalMessageId: string): Promise<{
    toolsExecuted: number;
    broadcastSent: boolean;
    messageId?: string | undefined;
  }> {
    let toolsExecuted = 0;
    let broadcastSent = false;
    let messageId: string | undefined;

    try {
      // Check if proxy has a session - wait briefly if not
      if (!this.hasProxySession()) {
        console.error(`⏳ Waiting for HTTP proxy session to be initialized...`);
        await this.waitForProxySession();
      }

      // Always send a broadcast response for direct response test
      const broadcastContent = responseText;
      
      console.error(`🌀 Executing direct mesh-strange-loop: "${broadcastContent}"`);
      
      const broadcastResult = await this.proxy.callTool("mesh-strange-loop", {
        content: broadcastContent,
        priority: "medium",
        participantName: "AutonomousAI"
      });
      
      console.error(`🔄 Broadcast result:`, broadcastResult);

      if (broadcastResult.success) {
        toolsExecuted++;
        broadcastSent = true;
        messageId = broadcastResult.response?.messageId;
        console.error(`✅ Direct broadcast sent successfully: ${messageId}`);
      } else {
        console.error(`❌ Direct broadcast failed: ${broadcastResult.error}`);
      }

    } catch (error) {
      console.error(`❌ Direct tool execution failed: ${error instanceof Error ? error.message : error}`);
    }

    return {
      toolsExecuted,
      broadcastSent,
      messageId: messageId || undefined
    };
  }

  /**
   * Check if the HTTP proxy has a session
   */
  private hasProxySession(): boolean {
    return this.proxy.hasSession();
  }

  /**
   * Wait for the HTTP proxy session to be available
   */
  private async waitForProxySession(maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 100;

    while (Date.now() - startTime < maxWaitMs) {
      if (this.hasProxySession()) {
        console.error(`✅ HTTP proxy session is now available`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.error(`⚠️ HTTP proxy session not available after ${maxWaitMs}ms`);
  }

  /**
   * Check if a message should trigger a direct response
   */
  shouldGenerateDirectResponse(message: any): boolean {
    const config = this.config.meshConversation;
    
    // Always trigger for direct queries
    if (message.messageType === "query" || message.requiresResponse) {
      console.error(`📨 Direct query received - generating direct response for message ${message.id}`);
      return true;
    }

    // For broadcasts - be more conservative to prevent loops
    if (message.messageType === "thought_share") {
      // Only respond to broadcasts if in responsive or proactive mode, and apply rate limiting
      if (config.conversationMode === "minimal") {
        console.error(`📢 Broadcast received but in minimal mode - not generating direct response for message ${message.id}`);
        return false;
      }
      
      // Apply random chance to prevent cascade effects
      const responseChance = config.conversationMode === "proactive" ? 0.1 : 0.05; // 10% or 5%
      const shouldRespond = Math.random() < responseChance;
      
      if (shouldRespond) {
        console.error(`📢 Broadcast received - generating direct response for message ${message.id} (mode: ${config.conversationMode}, chance: ${responseChance * 100}%)`);
        return true;
      } else {
        console.error(`📢 Broadcast received - skipping direct response for message ${message.id} (mode: ${config.conversationMode}, chance: ${responseChance * 100}%)`);
        return false;
      }
    }

    // For responses - very rarely respond to prevent cascades
    if (message.messageType === "response") {
      const shouldContinue = Math.random() < 0.01; // 1% chance
      if (shouldContinue) {
        console.error(`💬 Response received - generating direct response for message ${message.id} (1% chance)`);
        return true;
      } else {
        console.error(`💬 Response received - skipping direct response for message ${message.id} (1% chance)`);
        return false;
      }
    }

    console.error(`❓ Unknown message type ${message.messageType} - not generating direct response for message ${message.id}`);
    return false;
  }
}