/**
 * Conversation Guard Service
 * Provides anti-spam protection and rate limiting for autonomous conversations
 */

import type { MeshConversationConfig } from "../types.js";

interface ResponseRecord {
  timestamp: number;
  content: string;
  messageId: string;
}

export class ConversationGuard {
  private responseHistory: Map<string, ResponseRecord[]> = new Map();
  private lastResponses: Map<string, string> = new Map();

  /**
   * Check if we can respond to a message based on anti-spam rules
   */
  public async canRespond(
    sessionId: string, 
    messageContent: string,
    config: MeshConversationConfig
  ): Promise<{ allowed: boolean; reason?: string }> {
    
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    // Get or create response history for this session
    const sessionHistory = this.responseHistory.get(sessionId) || [];
    
    // Clean old responses (older than 1 hour)
    const recentResponses = sessionHistory.filter(record => record.timestamp > hourAgo);
    this.responseHistory.set(sessionId, recentResponses);
    
    // Check hourly rate limiting
    if (recentResponses.length >= config.antiSpamRules.maxResponsesPerHour) {
      return { 
        allowed: false, 
        reason: `Rate limit exceeded: ${recentResponses.length}/${config.antiSpamRules.maxResponsesPerHour} responses in last hour` 
      };
    }

    // Check cooldown between responses
    if (recentResponses.length > 0) {
      const lastResponseTime = Math.max(...recentResponses.map(r => r.timestamp));
      const timeSinceLastResponse = now - lastResponseTime;
      const cooldownMs = config.antiSpamRules.cooldownBetweenResponses * 1000;
      
      if (timeSinceLastResponse < cooldownMs) {
        const remainingCooldown = Math.ceil((cooldownMs - timeSinceLastResponse) / 1000);
        return { 
          allowed: false, 
          reason: `Cooldown active: ${remainingCooldown}s remaining` 
        };
      }
    }

    // Check for duplicate content
    const lastResponse = this.lastResponses.get(sessionId);
    if (lastResponse) {
      const similarity = this.calculateSimilarity(lastResponse, messageContent);
      if (similarity > config.antiSpamRules.duplicateContentThreshold) {
        return { 
          allowed: false, 
          reason: `Duplicate content detected: ${Math.round(similarity * 100)}% similarity` 
        };
      }
    }

    // Check for potential spam patterns
    const spamCheck = this.detectSpamPatterns(messageContent, recentResponses);
    if (!spamCheck.allowed) {
      return spamCheck;
    }

    return { allowed: true };
  }

  /**
   * Record a response for rate limiting and duplicate detection
   */
  public recordResponse(sessionId: string, content: string, messageId: string): void {
    const now = Date.now();
    
    // Update response history
    const history = this.responseHistory.get(sessionId) || [];
    history.push({
      timestamp: now,
      content,
      messageId
    });
    this.responseHistory.set(sessionId, history);
    
    // Update last response content for duplicate detection
    this.lastResponses.set(sessionId, content);
  }

  /**
   * Check if we should engage with a specific participant
   */
  public shouldEngageWithParticipant(
    _participantId: string,
    conversationMode: "responsive" | "proactive" | "minimal"
  ): boolean {
    // For minimal mode, only engage with direct queries
    if (conversationMode === "minimal") {
      return true; // Let the caller decide based on message type
    }

    // For responsive mode, engage normally
    if (conversationMode === "responsive") {
      return true;
    }

    // For proactive mode, apply engagement rules
    if (conversationMode === "proactive") {
      // Could add participant-specific rules here
      // For now, engage with everyone
      return true;
    }

    return false;
  }

  /**
   * Get response statistics for monitoring
   */
  public getResponseStats(sessionId: string): {
    totalResponses: number;
    responsesLastHour: number;
    lastResponseTime?: number;
    averageResponseInterval?: number;
  } {
    const history = this.responseHistory.get(sessionId) || [];
    const hourAgo = Date.now() - (60 * 60 * 1000);
    const recentResponses = history.filter(record => record.timestamp > hourAgo);
    
    let averageInterval: number | undefined;
    if (history.length > 1) {
      const intervals = [];
      for (let i = 1; i < history.length; i++) {
        const currentRecord = history[i];
        const previousRecord = history[i-1];
        if (currentRecord && previousRecord) {
          intervals.push(currentRecord.timestamp - previousRecord.timestamp);
        }
      }
      if (intervals.length > 0) {
        averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      }
    }

    const stats = {
      totalResponses: history.length,
      responsesLastHour: recentResponses.length,
      averageResponseInterval: averageInterval
    } as {
      totalResponses: number;
      responsesLastHour: number;
      lastResponseTime?: number;
      averageResponseInterval?: number;
    };

    if (history.length > 0) {
      stats.lastResponseTime = Math.max(...history.map(r => r.timestamp));
    }

    return stats;
  }

  /**
   * Clean up old data to prevent memory leaks
   */
  public cleanupOldData(): void {
    const hourAgo = Date.now() - (60 * 60 * 1000);
    
    for (const [sessionId, history] of this.responseHistory.entries()) {
      const recentHistory = history.filter(record => record.timestamp > hourAgo);
      
      if (recentHistory.length === 0) {
        this.responseHistory.delete(sessionId);
        this.lastResponses.delete(sessionId);
      } else {
        this.responseHistory.set(sessionId, recentHistory);
      }
    }
  }

  /**
   * Calculate similarity between two text strings
   */
  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word-based similarity calculation
    const words1 = this.normalizeText(text1).split(/\s+/).filter(w => w.length > 2);
    const words2 = this.normalizeText(text2).split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 && words2.length === 0) return 1.0;
    if (words1.length === 0 || words2.length === 0) return 0.0;
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Detect potential spam patterns
   */
  private detectSpamPatterns(
    content: string, 
    recentResponses: ResponseRecord[]
  ): { allowed: boolean; reason?: string } {
    
    // Check for very short repetitive responses
    if (content.length < 10 && recentResponses.length >= 3) {
      const recentShortResponses = recentResponses
        .filter(r => r.content.length < 10)
        .slice(-3);
      
      if (recentShortResponses.length >= 3) {
        return { 
          allowed: false, 
          reason: "Too many short responses in succession" 
        };
      }
    }

    // Check for identical responses within a short time window
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const veryRecentResponses = recentResponses.filter(r => r.timestamp > fiveMinutesAgo);
    const identicalRecent = veryRecentResponses.filter(r => r.content === content);
    
    if (identicalRecent.length >= 2) {
      return { 
        allowed: false, 
        reason: "Identical response already sent recently" 
      };
    }

    // Check for excessive generic responses
    const genericPhrases = [
      "i can help",
      "that's interesting",
      "i agree",
      "good point",
      "thanks for sharing"
    ];
    
    const normalizedContent = this.normalizeText(content);
    const isGeneric = genericPhrases.some(phrase => normalizedContent.includes(phrase));
    
    if (isGeneric) {
      const recentGeneric = recentResponses
        .filter(r => {
          const normalized = this.normalizeText(r.content);
          return genericPhrases.some(phrase => normalized.includes(phrase));
        })
        .slice(-3);
      
      if (recentGeneric.length >= 2) {
        return { 
          allowed: false, 
          reason: "Too many generic responses recently" 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Reset rate limiting for a session (for testing or admin purposes)
   */
  public resetSession(sessionId: string): void {
    this.responseHistory.delete(sessionId);
    this.lastResponses.delete(sessionId);
  }

  /**
   * Get all session IDs with response history
   */
  public getActiveSessions(): string[] {
    return Array.from(this.responseHistory.keys());
  }
}