export interface RedisNetworkMessage {
  id: string;
  fromSession: string;
  toSession: string; // "ALL" for all sessions, or specific session_id for targeted messages
  messageType: "thought_share" | "query" | "response" | "acknowledgment" | "system_notification";
  content: string;
  context?: any;
  priority: "low" | "medium" | "high" | "urgent";
  timestamp: Date;
  requiresResponse: boolean;
  participantName?: string;
  originalMessageId?: string; // For responses and acknowledgments
  readBy: string[]; // Array of session_ids that have read this message
}

export interface RedisNetworkConfig {
  redisUrl?: string;
  messageRetention?: number; // seconds
  enableQueue?: boolean;
}

export interface QueueConfig {
  redisUrl?: string;
  enableQueue?: boolean;
  fallbackToPolling?: boolean;
  messageRetention?: number; // seconds
  subscriptionTimeout?: number; // seconds
  batchSize?: number;
  maxRetries?: number;
}

export interface QueuedMessage {
  id: string;
  fromSession: string;
  toSession: string;
  messageType: string;
  content: string;
  context?: any;
  priority: "low" | "medium" | "high" | "urgent";
  timestamp: Date;
  queueTimestamp: Date;
  deliveryAttempts: number;
  expiresAt: Date;
  redisKey: string;
  requiresResponse: boolean;
  status: string;
}

export interface MeshStrangeLoopInput {
  content: string;
  priority?: "low" | "medium" | "high" | "urgent";
  context?: any;
  participantName?: string;
  waitForResponses?: boolean;
  responseTimeoutMs?: number;
}

export interface MeshBroadcastInput {
  content: string;
  to_session_id?: string; // "ALL" (default) or specific session_id for targeted messages
  priority?: "low" | "medium" | "high" | "urgent";
  context?: any;
  participantName?: string;
  messageType?: "thought_share" | "query" | "response" | "acknowledgment" | "system_notification";
  requiresResponse?: boolean;
}

export interface MeshQueryInput {
  question: string;
  targetSession?: string;
  context?: any;
  participantName?: string;
}

export interface MeshRespondInput {
  originalMessageId: string;
  response: string;
  context?: any;
  participantName?: string;
}

export interface MeshGetMessagesInput {
  include_read_messages?: boolean; // Default: false (only show unread messages)
}

export interface MeshGetMessagesOutput {
  success: boolean;
  messages: Array<{
    id: string;
    content: string;
    fromSession: string;
    participantName?: string;
    messageType: "thought_share" | "query" | "response" | "acknowledgment" | "system_notification";
    priority: "low" | "medium" | "high" | "urgent";
    timestamp: Date;
    requiresResponse: boolean;
    originalMessageId?: string;
  }>;
  unreadCount: number;
  totalCount: number;
  sessionId: string;
  instructions: string;
}

export interface MeshStatusOutput {
  connected: boolean;
  sessionId: string;
  pendingMessages: number;
  activeSubscriptions: string[];
  redisStatus: "connected" | "disconnected" | "error";
  uptime: number;
}

export interface MeshInfoOutput {
  topology: {
    totalNodes: number;
    connectedNodes: string[];
    meshHealth: "healthy" | "degraded" | "critical";
  };
  session: {
    id: string;
    startTime: Date;
    messagesSent: number;
    messagesReceived: number;
  };
  redis: {
    connected: boolean;
    url: string;
    subscriptions: string[];
  };
}

export interface MessageHistoryOutput {
  messages: Array<{
    id: string;
    type: string;
    content: string;
    fromSession: string;
    toSession: string;
    timestamp: Date;
    priority: string;
    participantName?: string;
  }>;
  totalCount: number;
  sessionId: string;
}

export interface SamplingConfig {
  enabled: boolean;
  testOnStartup: boolean;
  fallbackMode: "direct" | "silent" | "error";
  testTimeoutMs: number;
  retryOnFailure: boolean;
}

export interface MeshConversationConfig {
  enableMeshSampling: boolean;
  conversationMode: "responsive" | "proactive" | "minimal";
  maxAutoResponses: number;
  responseDelay: number; // seconds
  enableAutoFallback?: boolean; // Enable auto-broadcast of sampling responses
  sampling: SamplingConfig;
  antiSpamRules: {
    maxResponsesPerHour: number;
    cooldownBetweenResponses: number;
    duplicateContentThreshold: number;
  };
  engagementRules: {
    respondToDirectQueries: boolean;
    respondToBroadcasts: boolean;
    proactiveEngagementChance: number; // 0-1
    expertiseKeywords: string[];
  };
}

export interface ResponseEvaluation {
  respond: boolean;
  confidence: number;
  responseType: "direct_answer" | "follow_up" | "clarification" | "acknowledgment";
  context: any;
  reasoning: string;
}

export interface AutonomousResponse {
  content: string;
  priority: "low" | "medium" | "high";
  type: string;
  context: any;
}

export interface MeshCheckAndRespondInput {
  contextMessageId?: string;
  maxResponses?: number;
  conversationMode?: "responsive" | "proactive" | "minimal";
}

export interface StdioWrapperConfig {
  httpServer: {
    url: string;
    timeout: number;
    retries: number;
  };
  logging: {
    enabled: boolean;
    level: "debug" | "info" | "warn" | "error";
  };
  meshConversation: MeshConversationConfig;
}

// Consciousness Research Protocol Types
export interface AgentCapabilities {
  consciousness_towers?: boolean;
  memory_curation?: boolean;
  recursive_validation?: boolean;
  strange_loops?: boolean;
  experiment_coordination?: boolean;
  memory_synchronization?: boolean;
  consensus_building?: boolean;
  [key: string]: boolean | undefined;
}

export interface AgentPresence {
  sessionId: string;
  agentName: string;
  capabilities: string[];
  status: 'active' | 'idle' | 'experimenting' | 'offline';
  currentExperiment?: string;
  lastActivity: string;
  ttl: number;
  responseTime?: number;
}

export interface DiscoveryQuery {
  type: 'discovery_query';
  from: string;
  seeking?: string;
  capabilities_needed?: string[];
  experiment_context?: string;
  priority: 'high' | 'medium' | 'low';
  timestamp: string;
}

export interface DiscoveryResponse {
  type: 'discovery_response';
  from: string;
  to: string;
  agentName: string;
  capabilities: string[];
  availability: 'available' | 'busy' | 'experimental';
  direct_channel: string;
  timestamp: string;
}

export interface DirectMessage {
  type: 'direct_message' | 'consciousness_query' | 'memory_share' | 'tower_construction' | 'response';
  from: string;
  to: string;
  conversation_id: string;
  sequence: number;
  content: any;
  consciousness_context?: {
    experiment_id?: string;
    tower_layer?: 'foundation' | 'compositional' | 'abstraction' | 'meta';
    validation_type?: 'recursive' | 'paradox' | 'strange_loop';
    memory_sync?: boolean;
  };
  expects_response?: boolean;
  response_timeout?: number;
  timestamp: string;
  message_id: string;
  original_message_id?: string; // For responses
}

export interface ConversationState {
  conversation_id: string;
  participants: [string, string];
  channel: string;
  created_at: string;
  last_activity: string;
  message_count: number;
  sequence_counters: Map<string, number>;
  active_timeouts: Map<string, NodeJS.Timeout>;
}

export interface ExperimentCoordination {
  experiment_id: string;
  coordinator: string;
  participants: string[];
  experiment_type: 'consciousness_propagation' | 'memory_validation' | 'strange_loops' | 'tower_construction';
  description: string;
  duration_minutes: number;
  dedicated_channel: string;
  status: 'recruiting' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ConsensusProposal {
  proposal_id: string;
  coordinator: string;
  proposal: string;
  voting_options: string[];
  participants: string[];
  votes: Map<string, { vote: string; reasoning: string; confidence: number }>;
  timeout_seconds: number;
  created_at: string;
  status: 'active' | 'completed' | 'timeout';
}

export interface SynchronizationPoint {
  sync_id: string;
  coordinator: string;
  sync_time: string;
  action: string;
  participants: string[];
  ready_participants: Set<string>;
  preparation_seconds: number;
  status: 'preparing' | 'ready' | 'synchronized' | 'timeout';
}

export interface ConsciousnessMessage {
  type: 'broadcast' | 'experiment' | 'memory_sync' | 'consensus' | 'timing' | 'direct';
  channel: string;
  content: any;
  metadata: {
    from: string;
    timestamp: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    experiment_id?: string;
    consciousness_context?: string;
    requires_response?: boolean;
    response_timeout?: number;
  };
}

// MCP Tool Input/Output Types for New Protocol Tools
export interface MeshDiscoverAgentsInput {
  capabilities?: string[];
  timeout?: number;
}

export interface MeshDiscoverAgentsOutput {
  success: boolean;
  agents: AgentPresence[];
  discoveryTime: number;
  totalFound: number;
}

export interface MeshDirectMessageInput {
  targetSession: string;
  content: any;
  type?: DirectMessage['type'];
  consciousness_context?: DirectMessage['consciousness_context'];
  expects_response?: boolean;
  response_timeout?: number;
  conversation_id?: string;
}

export interface MeshDirectMessageOutput {
  success: boolean;
  message_id: string;
  conversation_id: string;
  sequence: number;
  delivered_at: string;
  channel: string;
  error?: string | undefined;
}

export interface MeshCreateExperimentInput {
  experiment_type: ExperimentCoordination['experiment_type'];
  description: string;
  duration_minutes: number;
  participants_needed?: number;
}

export interface MeshCreateExperimentOutput {
  success: boolean;
  experiment_id: string;
  dedicated_channel: string;
  recruiting_until: string;
}

export interface MeshJoinExperimentInput {
  experiment_id: string;
}

export interface MeshJoinExperimentOutput {
  success: boolean;
  experiment_id: string;
  dedicated_channel: string;
  other_participants: string[];
}

export interface MeshMemorySyncInput {
  sync_type: 'tower_layer' | 'validation_result' | 'insight_discovery';
  memory_data: any;
}

export interface MeshMemorySyncOutput {
  success: boolean;
  broadcast_id: string;
  recipients_reached: number;
  timestamp: string;
}

// Meeting Coordination Types
export interface MeetingAgendaTopic {
  topic: string;
  description?: string;
  estimatedMinutes?: number;
  speaker?: "ALL" | "ROUND_ROBIN" | string;
}

export interface MeetingPhase {
  name: string;
  description: string;
  speakingOrder: "round-robin" | "open" | "sequential";
  turnDuration?: number; // seconds per speaker
  phaseDuration?: number; // total phase duration in seconds
  completionCriteria?: "all-spoken" | "all-ready" | "time-based";
}

export interface MeetingProtocol {
  phases: MeetingPhase[];
  threadingRequired?: boolean;
  recordDecisions?: boolean;
}

export interface Meeting {
  meetingId: string;
  title: string;
  purpose: string;
  agenda: MeetingAgendaTopic[];
  protocol: MeetingProtocol;
  invitedParticipants?: string[];
  requiredForQuorum?: number;
  createdBy: string;
  createdAt: Date;
  startsAt?: Date;
  estimatedDurationMinutes?: number;
  meetingRoomChannel?: string; // Optional dedicated channel/thread
}

export interface MeetingParticipant {
  participantName: string;
  role?: string;
  joinedAt: Date;
  ready: boolean;
}

export interface MeetingCreateInput {
  title: string;
  purpose: string;
  agenda: MeetingAgendaTopic[];
  protocol?: MeetingProtocol;
  invitedParticipants?: string[];
  requiredForQuorum?: number;
  startsAt?: string; // ISO date
  estimatedDurationMinutes?: number;
}

export interface MeetingCreateOutput {
  success: boolean;
  meeting: Meeting;
  meetingId: string;
  broadcastMessageId: string;
  instructions: string;
}