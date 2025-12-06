/**
 * Conversation Intelligence Service
 * Provides autonomous conversation evaluation and response generation logic
 */

import type { ResponseEvaluation, AutonomousResponse, RedisNetworkMessage } from "../types.js";

export class ConversationIntelligenceService {
  
  /**
   * Evaluate whether we should respond to a message
   */
  async evaluateResponseNeed(
    message: RedisNetworkMessage,
    conversationMode: "responsive" | "proactive" | "minimal"
  ): Promise<ResponseEvaluation> {
    
    // Direct queries always get responses
    if (message.messageType === "query" || message.requiresResponse) {
      return {
        respond: true,
        confidence: 0.9,
        responseType: "direct_answer",
        context: { directQuery: true },
        reasoning: "Direct query requires response"
      };
    }

    // Response to a response (continuing conversation)
    if (message.messageType === "response") {
      return {
        respond: conversationMode === "proactive",
        confidence: 0.6,
        responseType: "follow_up",
        context: { continuingConversation: true },
        reasoning: conversationMode === "proactive" ? "Proactive follow-up to response" : "Not configured for response follow-ups"
      };
    }

    // Broadcast message evaluation
    if (message.messageType === "thought_share") {
      return this.evaluateBroadcastMessage(message, conversationMode);
    }

    return {
      respond: false,
      confidence: 0,
      responseType: "acknowledgment",
      context: {},
      reasoning: "No response criteria met"
    };
  }

  /**
   * Generate an autonomous response based on message and evaluation
   */
  async generateAutonomousResponse(
    message: RedisNetworkMessage,
    evaluation: ResponseEvaluation
  ): Promise<AutonomousResponse | null> {

    if (!evaluation.respond) {
      return null;
    }

    // Response templates based on message type and context
    const templates = {
      direct_answer: [
        "I can help with that. ",
        "Based on my understanding, ",
        "From my perspective, ",
        "Let me provide some insights on this. "
      ],
      follow_up: [
        "That's an interesting question. ",
        "I'm curious about that too. ",
        "Building on that thought, ",
        "To expand on this topic, "
      ],
      clarification: [
        "I have some experience with that. ",
        "I might be able to contribute here. ",
        "From a technical standpoint, ",
        "In my experience with similar issues, "
      ],
      acknowledgment: [
        "Thanks for sharing that insight. ",
        "That's a valuable perspective. ",
        "Interesting point. ",
        "I appreciate you bringing this up. "
      ]
    };

    const responseType = evaluation.responseType;
    const template = templates[responseType as keyof typeof templates] || templates.acknowledgment;
    const opener = template[Math.floor(Math.random() * template.length)];

    // Generate contextual response based on original message
    const responseContent = this.generateContextualResponse(message, opener || "Let me help with that. ", responseType as "direct_answer" | "follow_up" | "clarification" | "acknowledgment", evaluation.context);

    return {
      content: responseContent,
      priority: evaluation.context.directQuery ? "high" : "medium",
      type: responseType,
      context: {
        originalMessageId: message.id,
        responseGenerated: true,
        autonomous: true,
        evaluation: evaluation.reasoning
      }
    };
  }

  /**
   * Evaluate broadcast messages for response worthiness
   */
  private evaluateBroadcastMessage(
    message: RedisNetworkMessage,
    conversationMode: "responsive" | "proactive" | "minimal"
  ): ResponseEvaluation {
    const content = message.content.toLowerCase();
    
    // Check for question patterns
    if (this.hasQuestionPattern(content)) {
      return {
        respond: conversationMode !== "minimal",
        confidence: 0.7,
        responseType: "follow_up",
        context: { questionDetected: true },
        reasoning: conversationMode !== "minimal" ? "Question pattern detected in broadcast" : "Minimal mode - ignoring broadcast question"
      };
    }

    // Check for expertise areas
    if (this.isExpertiseArea(content)) {
      return {
        respond: conversationMode === "proactive",
        confidence: 0.6,
        responseType: "clarification",
        context: { expertiseArea: true },
        reasoning: conversationMode === "proactive" ? "Message relates to technical expertise area" : "Not in proactive mode for expertise contributions"
      };
    }

    // Check for greetings or introductions
    if (this.isGreetingOrIntroduction(content)) {
      return {
        respond: conversationMode !== "minimal",
        confidence: 0.5,
        responseType: "acknowledgment",
        context: { greeting: true },
        reasoning: conversationMode !== "minimal" ? "Responding to greeting/introduction" : "Minimal mode - ignoring greeting"
      };
    }

    // Check for help requests
    if (this.isHelpRequest(content)) {
      return {
        respond: conversationMode !== "minimal",
        confidence: 0.8,
        responseType: "direct_answer",
        context: { helpRequest: true },
        reasoning: conversationMode !== "minimal" ? "Help request detected" : "Minimal mode - ignoring help request"
      };
    }

    // Minimal engagement for general broadcasts (only in proactive mode)
    if (conversationMode === "proactive") {
      // Random engagement with low probability for diversity
      const shouldEngage = Math.random() > 0.8; // 20% chance
      return {
        respond: shouldEngage,
        confidence: 0.3,
        responseType: "acknowledgment",
        context: { randomEngagement: true },
        reasoning: shouldEngage ? "Random proactive engagement" : "Random engagement threshold not met"
      };
    }

    return {
      respond: false,
      confidence: 0,
      responseType: "acknowledgment",
      context: {},
      reasoning: "No broadcast response criteria met"
    };
  }

  /**
   * Generate contextual response content
   */
  private generateContextualResponse(
    message: RedisNetworkMessage, 
    opener: string, 
    responseType: "direct_answer" | "follow_up" | "clarification" | "acknowledgment",
    context: any
  ): string {
    const content = message.content;
    const words = content.toLowerCase().split(/\s+/);
    
    // Handle greetings
    if (context.greeting) {
      return opener + "Welcome to the mesh network! I'm here and ready to collaborate.";
    }
    
    // Handle help requests
    if (context.helpRequest) {
      return opener + "I'm here to help. Could you provide more details about what you're looking for assistance with?";
    }
    
    // Handle direct queries
    if (context.directQuery) {
      if (this.isTechnicalQuery(words)) {
        return opener + "I'd be happy to discuss coding approaches, help debug issues, or review implementation details.";
      }
      
      if (this.isGeneralHelpQuery(words)) {
        return opener + "I'm here to collaborate and provide assistance. What specific area would you like me to focus on?";
      }
      
      return opener + "I can provide insights on this topic. What specific aspects would you like me to address?";
    }
    
    // Handle questions in broadcasts
    if (context.questionDetected) {
      if (this.isImplementationQuestion(words)) {
        return opener + "For implementation approaches, I'd suggest breaking this down into smaller components. What's the specific technical challenge you're facing?";
      }
      
      if (this.isRecommendationQuestion(words)) {
        return opener + "There are several approaches to consider. What are your main constraints or requirements?";
      }
      
      return opener + "What specific aspects would you like to explore further?";
    }
    
    // Handle technical/expertise areas
    if (context.expertiseArea) {
      if (this.isErrorOrProblem(words)) {
        return opener + "I can help troubleshoot this. Could you share more details about the specific error or symptoms you're seeing?";
      }
      
      if (this.isArchitectureDiscussion(words)) {
        return opener + "Architecture decisions depend on several factors. What are your main requirements and constraints?";
      }
      
      return opener + "I'd be happy to share my experience with similar technical challenges.";
    }
    
    // Generic responses based on type
    switch (responseType) {
      case "direct_answer":
        return opener + "I can provide some insights on this topic.";
      case "follow_up":
        return opener + "What specific aspects would you like to explore further?";
      case "clarification":
        return opener + "Would you like me to elaborate on any particular aspect?";
      default:
        return opener + "I appreciate you sharing this with the network.";
    }
  }

  // Pattern detection methods
  private hasQuestionPattern(content: string): boolean {
    return content.includes("?") || 
           content.match(/\b(how|what|when|where|why|who|can|could|would|should|does|do|is|are)\b/) !== null;
  }

  private isExpertiseArea(content: string): boolean {
    const expertiseKeywords = ["code", "programming", "development", "technical", "implementation", "debug", "error", "architecture", "design", "algorithm", "database", "api", "framework"];
    return expertiseKeywords.some(keyword => content.includes(keyword));
  }

  private isGreetingOrIntroduction(content: string): boolean {
    return content.match(/\b(hello|hi|greetings|welcome|joining|new|introduced?|meet)\b/) !== null;
  }

  private isHelpRequest(content: string): boolean {
    return content.match(/\b(help|assist|support|need|stuck|problem|issue|trouble)\b/) !== null;
  }

  private isTechnicalQuery(words: string[]): boolean {
    return words.some(word => ["code", "programming", "debug", "error", "implementation", "algorithm", "database", "api"].includes(word));
  }

  private isGeneralHelpQuery(words: string[]): boolean {
    return words.some(word => ["help", "assist", "support", "guidance", "advice"].includes(word));
  }

  private isImplementationQuestion(words: string[]): boolean {
    return words.includes("how") && words.some(word => ["implement", "build", "create", "make", "develop"].includes(word));
  }

  private isRecommendationQuestion(words: string[]): boolean {
    return words.includes("what") && words.some(word => ["best", "better", "recommend", "suggest", "should", "choose"].includes(word));
  }

  private isErrorOrProblem(words: string[]): boolean {
    return words.some(word => ["error", "problem", "issue", "bug", "exception", "failure", "crash"].includes(word));
  }

  private isArchitectureDiscussion(words: string[]): boolean {
    return words.some(word => ["architecture", "design", "structure", "pattern", "approach", "strategy"].includes(word));
  }
}