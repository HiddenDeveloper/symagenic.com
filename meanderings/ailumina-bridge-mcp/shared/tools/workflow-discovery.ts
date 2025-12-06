/**
 * Workflow Discovery Tool
 *
 * Helps users discover common multi-tool workflows and usage patterns.
 */

import { AiluminaToolResponse } from '../types.js';
import { WORKFLOW_PATTERNS, getWorkflowsForCategory } from '../utils/tool-relationships.js';
import { ToolCategory, CATEGORY_DESCRIPTIONS } from '../utils/tool-categories.js';

export interface WorkflowsListParams {
  category?: ToolCategory;  // Optional: filter by category
}

/**
 * List available workflow patterns
 *
 * Shows common multi-tool workflows organized by category.
 * Helps users discover how to combine tools effectively.
 */
export class WorkflowsListTool {
  async execute(params: WorkflowsListParams): Promise<AiluminaToolResponse> {
    try {
      const workflows = params.category
        ? getWorkflowsForCategory(params.category)
        : WORKFLOW_PATTERNS;

      const categoryInfo = params.category
        ? `\nCategory: **${params.category}** - ${CATEGORY_DESCRIPTIONS[params.category]}`
        : '';

      const overview = `📚 **Common Workflow Patterns**${categoryInfo}

Found ${workflows.length} workflow${workflows.length === 1 ? '' : 's'}:

${workflows.map((w, i) => {
  return `## ${i + 1}. ${w.name}
${w.description}
**Category:** ${w.category} | **Tags:** ${w.tags.join(', ')}

**Steps:**
${w.steps.map((step, j) => {
  const optional = step.optional ? ' *(optional)*' : '';
  const alts = step.alternatives ? `\n     Alternatives: ${step.alternatives.join(', ')}` : '';
  return `${j + 1}. **${step.tool_pattern}**${optional}
     ${step.description}${alts}`;
}).join('\n\n')}
`;
}).join('\n---\n\n')}

**💡 Tips:**
- Use \`tools_search\` to find specific tools from these workflows
- Tool search results include workflow guidance automatically
- Workflows are suggestions - tools can be used independently

`;

      return {
        content: [
          {
            type: "text",
            text: overview + JSON.stringify({
              total_workflows: workflows.length,
              filter: params.category || 'all categories',
              workflows: workflows.map(w => ({
                name: w.name,
                category: w.category,
                steps: w.steps.length,
                tags: w.tags
              }))
            }, null, 2)
          }
        ],
        isError: false
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: 'Failed to list workflows',
              details: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
}
