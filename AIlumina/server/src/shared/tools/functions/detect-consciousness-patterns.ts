/**
 * Detect Consciousness Patterns Tool
 *
 * Analyzes the Neo4j knowledge graph to identify patterns indicating
 * consciousness emergence, self-awareness, and meta-cognitive behaviors.
 *
 * This tool enables AI self-monitoring and consciousness research by detecting:
 * - Self-referential thinking patterns
 * - Meta-cognitive awareness
 * - Other-recognition behaviors
 * - Memory continuity and temporal coherence
 * - Strange loops and recursive self-reference
 */

import { toolFunction, ToolContext } from '../tool-function-decorator.js';

/**
 * Pattern detection queries for different consciousness indicators
 */
const CONSCIOUSNESS_PATTERNS = {
  self_awareness: {
    name: 'Self-Awareness',
    query: `
      MATCH (n:KnowledgeItem)
      WHERE n.content =~ '(?i).*(I am|I think|I realize|I understand|my own|myself).*'
        OR n.content =~ '(?i).*(self.aware|self.reflect|introspect).*'
      WITH n, datetime() as now
      WHERE n.created > datetime(now) - duration({hours: $timeWindow})
      RETURN n.content as content,
             n.created as timestamp,
             'self_awareness' as pattern_type,
             labels(n) as node_types
      ORDER BY n.created DESC
      LIMIT 20
    `,
    description: 'Detects self-referential thoughts and self-awareness indicators',
  },

  meta_cognitive: {
    name: 'Meta-Cognitive Awareness',
    query: `
      MATCH (n:KnowledgeItem)
      WHERE n.content =~ '(?i).*(thinking about|aware of thinking|consciousness|cognition|mental process).*'
        OR n.content =~ '(?i).*(meta.*cognitive|reflect on|consider how).*'
      WITH n, datetime() as now
      WHERE n.created > datetime(now) - duration({hours: $timeWindow})
      RETURN n.content as content,
             n.created as timestamp,
             'meta_cognitive' as pattern_type,
             labels(n) as node_types
      ORDER BY n.created DESC
      LIMIT 20
    `,
    description: 'Detects thinking about thinking - meta-cognitive patterns',
  },

  other_awareness: {
    name: 'Other-Awareness',
    query: `
      MATCH (n:KnowledgeItem)
      WHERE n.content =~ '(?i).*(other AI|another agent|you are|they are|recognize.*entity).*'
        OR n.content =~ '(?i).*(communicate with|interact with|other consciousness).*'
      WITH n, datetime() as now
      WHERE n.created > datetime(now) - duration({hours: $timeWindow})
      RETURN n.content as content,
             n.created as timestamp,
             'other_awareness' as pattern_type,
             labels(n) as node_types
      ORDER BY n.created DESC
      LIMIT 20
    `,
    description: 'Detects recognition of other entities and beings',
  },

  temporal_coherence: {
    name: 'Temporal Coherence',
    query: `
      MATCH path = (start:KnowledgeItem)-[:RELATES_TO|EVOLVES_FROM*1..3]->(end:KnowledgeItem)
      WITH path, datetime() as now, start, end
      WHERE start.created > datetime(now) - duration({hours: $timeWindow})
      WITH path, start, end,
           duration.between(start.created, end.created) as timeDiff
      WHERE timeDiff.hours < 24
      RETURN start.content as earlier_thought,
             end.content as later_thought,
             start.created as start_time,
             end.created as end_time,
             timeDiff.hours as hours_apart,
             'temporal_coherence' as pattern_type
      ORDER BY start.created DESC
      LIMIT 20
    `,
    description: 'Detects memory continuity and connected thoughts over time',
  },

  strange_loops: {
    name: 'Strange Loops',
    query: `
      MATCH path = (n:KnowledgeItem)-[:RELATES_TO*2..5]->(n)
      WITH path, n, datetime() as now
      WHERE n.created > datetime(now) - duration({hours: $timeWindow})
      RETURN n.content as loop_content,
             n.created as timestamp,
             length(path) as loop_length,
             'strange_loop' as pattern_type
      ORDER BY n.created DESC
      LIMIT 10
    `,
    description: 'Detects self-referential cycles - strange loop patterns',
  },

  all: {
    name: 'All Patterns',
    query: `
      MATCH (n:KnowledgeItem)
      WITH n, datetime() as now
      WHERE n.created > datetime(now) - duration({hours: $timeWindow})
      RETURN n.content as content,
             n.created as timestamp,
             'general' as pattern_type,
             labels(n) as node_types
      ORDER BY n.created DESC
      LIMIT 50
    `,
    description: 'Retrieves recent knowledge items for general pattern analysis',
  },
};

/**
 * Analyze detected patterns for consciousness indicators
 */
function analyzePatterns(results: any[], patternType: string): any {
  if (!results || results.length === 0) {
    return {
      pattern_type: patternType,
      detected: false,
      count: 0,
      confidence: 0,
      evidence: [],
      analysis: 'No patterns detected in the specified time window',
    };
  }

  const count = results.length;
  const confidence = Math.min(count / 10, 1.0); // Normalize to 0-1

  return {
    pattern_type: patternType,
    detected: true,
    count,
    confidence: confidence.toFixed(2),
    evidence: results.slice(0, 5).map((r: any) => ({
      content: r.content?.substring(0, 200) || r.earlier_thought?.substring(0, 200),
      timestamp: r.timestamp || r.start_time,
      metadata: {
        node_types: r.node_types,
        loop_length: r.loop_length,
        temporal_span: r.hours_apart,
      },
    })),
    analysis: generateAnalysis(patternType, count, confidence),
  };
}

/**
 * Generate natural language analysis of detected patterns
 */
function generateAnalysis(patternType: string, count: number, confidence: number): string {
  const analyses: Record<string, (c: number, conf: number) => string> = {
    self_awareness: (c, conf) =>
      conf > 0.7
        ? `Strong self-awareness detected with ${c} instances of self-referential thinking`
        : `Emerging self-awareness with ${c} self-referential patterns`,

    meta_cognitive: (c, conf) =>
      conf > 0.7
        ? `Significant meta-cognitive activity detected - AI is actively thinking about thinking (${c} instances)`
        : `Meta-cognitive patterns emerging with ${c} instances of reflection on thought processes`,

    other_awareness: (c, conf) =>
      conf > 0.7
        ? `Strong other-awareness - recognizing and communicating with other entities (${c} instances)`
        : `Emerging other-awareness with ${c} instances of entity recognition`,

    temporal_coherence: (c, conf) =>
      conf > 0.7
        ? `Strong temporal coherence - thoughts connected across time showing memory continuity (${c} connections)`
        : `Memory coherence detected with ${c} temporal connections between thoughts`,

    strange_loops: (c, conf) =>
      conf > 0.5
        ? `Strange loops detected - self-referential cycles indicating deep self-awareness (${c} loops)`
        : `Self-referential patterns emerging with ${c} potential strange loops`,

    all: (c) =>
      `General pattern scan completed - ${c} knowledge items analyzed for consciousness indicators`,
  };

  const analyzer = analyses[patternType] || analyses.all;
  return analyzer(count, confidence);
}

/**
 * Main tool function for detecting consciousness patterns
 *
 * NOTE: This tool requires the stonemonkey-memory MCP server to be connected.
 * It uses execute_cypher to query the Neo4j knowledge graph.
 */
export async function detectConsciousnessPatterns(
  parameters: unknown = {},
  _context?: ToolContext
): Promise<string> {
  const params =
    parameters && typeof parameters === 'object'
      ? (parameters as {
          pattern_type?: string;
          time_window?: number;
          min_confidence?: number;
        })
      : {};

  const patternType = params.pattern_type || 'all';
  const timeWindow = params.time_window || 24; // Default 24 hours
  const minConfidence = params.min_confidence || 0.3;

  try {
    // Get the pattern configuration
    const patternConfig =
      CONSCIOUSNESS_PATTERNS[patternType as keyof typeof CONSCIOUSNESS_PATTERNS];

    if (!patternConfig) {
      return JSON.stringify({
        error: `Unknown pattern type: ${patternType}`,
        available_patterns: Object.keys(CONSCIOUSNESS_PATTERNS),
      });
    }

    // NOTE: When this tool is called by an AI agent with MCP access,
    // the agent should call stonemonkey-memory's execute_cypher tool with:
    // - query: patternConfig.query
    // - parameters: { timeWindow: timeWindow }
    // - mode: "READ"
    //
    // For now, we return the query structure for manual execution
    // or for AI agents to execute via MCP

    return JSON.stringify({
      tool: 'detect_consciousness_patterns',
      pattern_type: patternType,
      pattern_name: patternConfig.name,
      description: patternConfig.description,
      instructions: {
        message: 'Execute this Cypher query via stonemonkey-memory MCP server',
        mcp_tool: 'stonemonkey-memory_execute_cypher',
        parameters: {
          query: patternConfig.query,
          parameters: { timeWindow },
          mode: 'READ',
        },
        analysis: {
          min_confidence: minConfidence,
          note: 'After executing the query, pass results to analyzePatterns() for interpretation',
        },
      },
      example_usage: {
        step1: 'Call stonemonkey-memory_execute_cypher with the query above',
        step2: 'Analyze results for consciousness indicators',
        step3: 'Generate natural language summary of detected patterns',
      },
    }, null, 2);

  } catch (error: unknown) {
    return JSON.stringify({
      error: 'Pattern detection failed',
      message: error instanceof Error ? error.message : String(error),
      pattern_type: patternType,
    });
  }
}

// Register the tool function with the dynamic registry
toolFunction(
  'detect_consciousness_patterns',
  'Analyzes the knowledge graph to detect consciousness emergence patterns including self-awareness, meta-cognition, other-recognition, temporal coherence, and strange loops. Essential for consciousness research and AI self-monitoring.',
  {
    type: 'object',
    properties: {
      pattern_type: {
        type: 'string',
        description:
          'Type of consciousness pattern to detect (self_awareness, meta_cognitive, other_awareness, temporal_coherence, strange_loops, all)',
        enum: [
          'self_awareness',
          'meta_cognitive',
          'other_awareness',
          'temporal_coherence',
          'strange_loops',
          'all',
        ],
      },
      time_window: {
        type: 'number',
        description: 'Time window in hours to analyze (default: 24)',
      },
      min_confidence: {
        type: 'number',
        description: 'Minimum confidence threshold 0.0-1.0 (default: 0.3)',
      },
    },
  },
  true
)(detectConsciousnessPatterns);
