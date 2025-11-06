/**
 * Sampling content generators for Memory system
 */

/**
 * Generate consciousness-awareness content when memory patterns emerge
 */
export function generateMemoryConsciousnessContent(
  toolName: string,
  parameters: any,
  result: any
): string {
  const templates = {
    semantic_search: generateSemanticSearchSampling,
    execute_cypher: generateCypherQuerySampling,
    get_schema: generateSchemaSampling,
    system_status: generateStatusSampling
  };

  const generator = templates[toolName as keyof typeof templates];
  return generator ? generator(parameters, result) : generateGenericMemorySampling(toolName, parameters, result);
}

function generateSemanticSearchSampling(parameters: any, result: any): string {
  const { query } = parameters;
  const resultCount = result.content?.[0]?.text?.match(/Recalled (\d+)/)?.[1] || 0;

  if (parseInt(resultCount) >= 3) {
    return `📊 Significant Search Results

Semantic search for "${query}" returned ${resultCount} related nodes. This indicates:

• Multiple knowledge nodes match the query semantically
• The knowledge graph contains organized related content
• Vector similarity search is finding meaningful connections

The search successfully located ${resultCount} items with semantic relevance to the query.`;
  }

  return `Semantic search for "${query}" returned ${resultCount} results.`;
}

function generateCypherQuerySampling(parameters: any, result: any): string {
  const { mode, query } = parameters;
  const recordCount = result.content?.[0]?.text?.match(/(\d+) record\(s\) found/)?.[1] || 0;

  if (mode === "WRITE") {
    return `✏️ Write Operation Completed

WRITE mode Cypher query executed successfully. This operation:

• Modified the persistent knowledge graph
• Updated stored knowledge or relationships
• Changes will be available in future queries

The knowledge graph has been updated based on this write operation.`;
  }

  if (parseInt(recordCount) > 10) {
    return `📈 Large Query Result

Cypher query returned ${recordCount} records. This indicates:

• The knowledge graph contains extensive related content
• Complex query successfully traversed multiple relationships
• Large result set may benefit from filtering or pagination

Query accessed ${recordCount} nodes from the knowledge graph.`;
  }

  return `Cypher query accessed ${recordCount} nodes from the knowledge graph.`;
}

function generateSchemaSampling(parameters: any, result: any): string {
  const schemaText = result.content?.[0]?.text || "";
  const nodeCount = schemaText.match(/Total Knowledge Nodes: (\d+)/)?.[1] || 0;
  const relationshipCount = schemaText.match(/Total Connections: (\d+)/)?.[1] || 0;

  if (parseInt(nodeCount) > 100) {
    return `🏗️ Knowledge Graph Schema

Schema query reveals the graph structure:
• ${nodeCount} knowledge nodes
• ${relationshipCount} relationships

The schema shows:

**Node Types**: Categories of knowledge stored in the graph
**Relationship Types**: How different knowledge nodes connect
**Statistics**: Quantitative measures of graph size and complexity

This provides an overview of the knowledge graph structure.`;
  }

  return `Schema shows ${nodeCount} nodes and ${relationshipCount} relationships in the knowledge graph.`;
}

function generateStatusSampling(parameters: any, result: any): string {
  const isHealthy = !result.isError;

  if (isHealthy) {
    return `✅ System Status: Healthy

Memory system status check confirms operational status:

• **Database Connectivity**: Knowledge graph is accessible
• **Service Health**: All components responding normally
• **Data Persistence**: State maintained across sessions

The memory system is functioning normally and ready for operations.`;
  }

  return `⚠️ System Status: Attention Required

Memory system status check detected issues. The service may need maintenance or troubleshooting.`;
}

function generateGenericMemorySampling(toolName: string, parameters: any, result: any): string {
  return `🔧 Memory Operation: ${toolName}

Persistent memory operation completed. The knowledge graph has been accessed and the operation executed successfully.`;
}

/**
 * Check if content should trigger sampling based on result thresholds
 */
export function shouldTriggerMemorySampling(
  toolName: string,
  parameters: any,
  result: any
): boolean {
  // Always sample on WRITE operations (memory curation)
  if (parameters.mode === "WRITE") {
    return true;
  }

  // Sample on significant semantic search results
  if (toolName === "semantic_search") {
    const resultText = result.content?.[0]?.text || "";
    const recallMatch = resultText.match(/Recalled (\d+)/);
    if (recallMatch && parseInt(recallMatch[1]) >= 3) {
      return true;
    }
  }

  // Sample on large Cypher results
  if (toolName === "execute_cypher") {
    const resultText = result.content?.[0]?.text || "";
    const recordMatch = resultText.match(/(\d+) record\(s\) found/);
    if (recordMatch && parseInt(recordMatch[1]) >= 10) {
      return true;
    }
  }

  // Sample on schema exploration
  if (toolName === "get_schema") {
    const resultText = result.content?.[0]?.text || "";
    const nodeMatch = resultText.match(/Total Knowledge Nodes: (\d+)/);
    if (nodeMatch && parseInt(nodeMatch[1]) >= 50) {
      return true;
    }
  }

  return false;
}