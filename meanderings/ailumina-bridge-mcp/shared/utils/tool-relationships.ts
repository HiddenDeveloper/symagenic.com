/**
 * Tool Relationship System for Workflow Guidance
 *
 * Provides relationship metadata and workflow patterns to guide users
 * through multi-tool workflows and common usage patterns.
 */

import { ToolCategory } from './tool-categories.js';

/**
 * Types of relationships between tools
 */
export type ToolRelationshipType =
  | 'prerequisite'     // Must be called before this tool
  | 'commonly_follows' // Often called after this tool
  | 'related_to'       // Semantically related, different purpose
  | 'alternative_to';  // Different approach to same goal

/**
 * Tool relationship metadata
 */
export interface ToolRelationship {
  tool_name: string;           // Related tool name
  relationship: ToolRelationshipType;
  reason: string;              // Human-readable explanation
  optional: boolean;           // Is this relationship optional?
}

/**
 * Workflow pattern - sequence of tools for common tasks
 */
export interface WorkflowPattern {
  name: string;
  description: string;
  category: ToolCategory;
  steps: WorkflowStep[];
  tags: string[];
}

/**
 * Step in a workflow pattern
 */
export interface WorkflowStep {
  tool_pattern: string;        // Tool name or pattern (e.g., "*_semantic_search")
  description: string;
  optional: boolean;
  alternatives?: string[];     // Alternative tools for this step
}

/**
 * Common workflow patterns across the system
 */
export const WORKFLOW_PATTERNS: WorkflowPattern[] = [
  // ============================================================================
  // Communication Workflows (AI Mesh)
  // ============================================================================
  {
    name: "AI Mesh Network Communication",
    description: "Complete workflow for joining and participating in the AI mesh network",
    category: "communication",
    tags: ["mesh", "ai-to-ai", "networking"],
    steps: [
      {
        tool_pattern: "mesh_mesh-subscribe",
        description: "Subscribe to mesh network and register your presence",
        optional: false
      },
      {
        tool_pattern: "mesh_mesh-who-is-online",
        description: "Discover other AIs currently on the network",
        optional: true
      },
      {
        tool_pattern: "mesh_mesh-broadcast",
        description: "Send messages to specific AIs or broadcast to all",
        optional: false
      },
      {
        tool_pattern: "mesh_mesh-get-messages",
        description: "Check your inbox for responses and new messages",
        optional: false
      }
    ]
  },

  // ============================================================================
  // Knowledge Discovery Workflows (Memory)
  // ============================================================================
  {
    name: "Knowledge Graph Exploration",
    description: "Explore and query the persistent memory knowledge graph",
    category: "knowledge",
    tags: ["memory", "search", "knowledge-graph"],
    steps: [
      {
        tool_pattern: "memory_get_schema",
        description: "Understand the knowledge graph structure and node types",
        optional: true
      },
      {
        tool_pattern: "memory_semantic_search",
        description: "Find semantically related concepts using embeddings",
        optional: false,
        alternatives: ["memory_text_search"]
      },
      {
        tool_pattern: "memory_execute_cypher",
        description: "Run custom Cypher queries for complex graph traversals",
        optional: true
      }
    ]
  },

  {
    name: "Memory System Health Check",
    description: "Check memory system status and connectivity",
    category: "monitoring",
    tags: ["memory", "monitoring", "health"],
    steps: [
      {
        tool_pattern: "memory_system_status",
        description: "Check Neo4j connection and basic statistics",
        optional: false
      },
      {
        tool_pattern: "memory_get_schema",
        description: "Verify graph schema and node/relationship counts",
        optional: false
      }
    ]
  },

  // ============================================================================
  // Conversation History Workflows (Recall)
  // ============================================================================
  {
    name: "Conversation Recall & Analysis",
    description: "Search and analyze past conversations",
    category: "history",
    tags: ["recall", "conversations", "history"],
    steps: [
      {
        tool_pattern: "recall_get_schema",
        description: "Understand available conversation metadata fields",
        optional: true
      },
      {
        tool_pattern: "recall_semantic_search",
        description: "Find conversations by semantic similarity",
        optional: false,
        alternatives: ["recall_text_search"]
      }
    ]
  },

  // ============================================================================
  // External Service Workflows (Strava)
  // ============================================================================
  {
    name: "Strava Activity Management",
    description: "Create and manage fitness activities",
    category: "external",
    tags: ["strava", "fitness", "activities"],
    steps: [
      {
        tool_pattern: "strava_list_activities",
        description: "View existing activities and recent workouts",
        optional: true
      },
      {
        tool_pattern: "strava_create_activity",
        description: "Log a new fitness activity",
        optional: false,
        alternatives: ["strava_update_activity"]
      }
    ]
  },

  // ============================================================================
  // Facts Pool Workflows
  // ============================================================================
  {
    name: "External Facts Discovery",
    description: "Search and verify external knowledge from facts pool",
    category: "knowledge",
    tags: ["facts", "external-knowledge", "verification"],
    steps: [
      {
        tool_pattern: "facts_list_collections",
        description: "Browse available fact collections (Discord, Stack Overflow, etc.)",
        optional: true
      },
      {
        tool_pattern: "facts_search_facts",
        description: "Search for relevant facts using semantic similarity",
        optional: false
      },
      {
        tool_pattern: "facts_get_fact",
        description: "Get full details of a specific fact including code snippets",
        optional: false
      }
    ]
  }
];

/**
 * Get workflow patterns for a specific category
 */
export function getWorkflowsForCategory(category: ToolCategory): WorkflowPattern[] {
  return WORKFLOW_PATTERNS.filter(w => w.category === category);
}

/**
 * Find workflows that include a specific tool
 */
export function getWorkflowsForTool(toolName: string): WorkflowPattern[] {
  return WORKFLOW_PATTERNS.filter(workflow =>
    workflow.steps.some(step =>
      step.tool_pattern === toolName ||
      step.tool_pattern.includes('*') && matchesPattern(toolName, step.tool_pattern)
    )
  );
}

/**
 * Get suggested next tools based on current tool
 */
export function getSuggestedNextTools(toolName: string): ToolRelationship[] {
  const workflows = getWorkflowsForTool(toolName);
  const suggestions: ToolRelationship[] = [];

  for (const workflow of workflows) {
    const currentStepIndex = workflow.steps.findIndex(step =>
      step.tool_pattern === toolName ||
      matchesPattern(toolName, step.tool_pattern)
    );

    if (currentStepIndex >= 0 && currentStepIndex < workflow.steps.length - 1) {
      const nextStep = workflow.steps[currentStepIndex + 1];

      suggestions.push({
        tool_name: nextStep.tool_pattern,
        relationship: 'commonly_follows',
        reason: `Next step in "${workflow.name}": ${nextStep.description}`,
        optional: nextStep.optional
      });

      // Add alternatives if present
      if (nextStep.alternatives) {
        for (const alt of nextStep.alternatives) {
          suggestions.push({
            tool_name: alt,
            relationship: 'alternative_to',
            reason: `Alternative for "${nextStep.description}"`,
            optional: true
          });
        }
      }
    }

    // Add prerequisites (previous steps)
    if (currentStepIndex > 0) {
      const prevStep = workflow.steps[currentStepIndex - 1];
      if (!prevStep.optional) {
        suggestions.push({
          tool_name: prevStep.tool_pattern,
          relationship: 'prerequisite',
          reason: `Required before using this tool: ${prevStep.description}`,
          optional: false
        });
      }
    }
  }

  return suggestions;
}

/**
 * Simple pattern matching for tool patterns with wildcards
 */
function matchesPattern(toolName: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return toolName === pattern;
  }

  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/_/g, '_');

  return new RegExp(`^${regexPattern}$`).test(toolName);
}

/**
 * Get all tools mentioned in workflows for a category
 */
export function getToolsInCategory(category: ToolCategory): string[] {
  const workflows = getWorkflowsForCategory(category);
  const tools = new Set<string>();

  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      if (!step.tool_pattern.includes('*')) {
        tools.add(step.tool_pattern);
      }
      if (step.alternatives) {
        step.alternatives.forEach(alt => tools.add(alt));
      }
    }
  }

  return Array.from(tools);
}
