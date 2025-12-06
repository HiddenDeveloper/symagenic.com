/**
 * Shared types for ai-recall-mcp
 */

// Configuration
export interface QdrantConfig {
  url: string;
  collection: string;
}

// Tool parameters
export interface SchemaParams {
  include_statistics?: boolean;
}

export interface SemanticSearchParams {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface TextSearchParams {
  query: string;
  limit?: number;
  fields?: string[];
  provider?: string;
  date_from?: string;
  date_to?: string;
}

// Tool responses
export interface RecallToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// Conversation turn payload structure (matches uploaded data)
export interface ConversationTurnPayload {
  turn_id: string;
  conversation_id: string;
  conversation_title: string;
  date_time: string;
  sequence: number;
  role: 'user' | 'ai';
  provider: string;
  model: string | null;
  text: string;
  embedding_model: string;

  // Category fields (added during classification)
  categories?: string[];
  primary_category?: string;
  subcategories?: string[];
  complexity_level?: 'beginner' | 'intermediate' | 'advanced';
  interaction_type?: 'question' | 'debugging' | 'explanation' | 'discussion' | 'task';
  topic_tags?: string[];
  classification_confidence?: number;
  classification_method?: 'llm' | 'keyword' | 'hybrid';
  classification_timestamp?: string;

  // Anomaly detection fields
  has_anomaly?: boolean;
  anomaly_types?: string[];
  anomaly_description?: string | null;
  anomaly_value?: 'low' | 'medium' | 'high' | null;
}

// Search result
export interface SearchResult {
  score: number;
  payload: ConversationTurnPayload;
  id: number;
}
