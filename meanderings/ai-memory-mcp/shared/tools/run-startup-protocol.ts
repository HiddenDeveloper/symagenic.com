/**
 * Startup Protocol Tool
 *
 * Enforced initialization sequence for session continuity.
 * Combines Anthropic's startup checklist with Stone Monkey's memory-first approach.
 */

import { Neo4jService } from '../neo4j-service.js';
import type { Neo4jConfig, MemoryToolResponse } from '../types.js';

export interface RunStartupProtocolParams {
  agent_name: string;
  session_id?: string;
}

export class RunStartupProtocolTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: RunStartupProtocolParams): Promise<MemoryToolResponse> {
    try {
      const service = this.createService(config);
      let output = `🚀 Stone Monkey Startup Protocol v1.0.0\n`;
      output += `Agent: ${params.agent_name}\n`;
      output += `=`.repeat(60) + `\n\n`;

      const steps: string[] = [];

      // Step 1: Load Current Focus
      try {
        const focusQuery = `
          MATCH (landing:FocusArea {name: 'AIluminaLandingPage'})
          RETURN landing.name as focus,
                 landing.current_work as current_work,
                 landing.active_areas as active_areas
        `;
        const focusResult = await service.executeCypher(focusQuery, {}, 'READ');

        if (focusResult && focusResult.length > 0 && focusResult[0]) {
          const focus = focusResult[0]?.focus;
          steps.push(`✅ **Step 1: Load Current Focus**\n   Focus: ${focus}`);
        } else {
          steps.push(`⚠️  **Step 1: Load Current Focus**\n   No AIluminaLandingPage found`);
        }
      } catch (error) {
        steps.push(`❌ **Step 1: Load Current Focus**\n   Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Step 2: Git Status (placeholder)
      steps.push(`📝 **Step 2: Check Git Status**\n   Requires external bash tool - use: git status`);

      // Step 3: Recent Observations
      try {
        const obsQuery = `
          MATCH (obs:Observation)
          WHERE obs.created > datetime() - duration('P7D')
          RETURN count(obs) as recent_count,
                 collect(obs.name)[0..5] as recent_names
        `;
        const obsResult = await service.executeCypher(obsQuery, {}, 'READ');

        if (obsResult && obsResult.length > 0 && obsResult[0]) {
          const count = obsResult[0]?.recent_count || 0;
          steps.push(`✅ **Step 3: Review Recent Observations**\n   Found ${count} observations from last 7 days`);
        } else {
          steps.push(`⚠️  **Step 3: Review Recent Observations**\n   No recent observations found`);
        }
      } catch (error) {
        steps.push(`❌ **Step 3: Review Recent Observations**\n   Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Step 4: Blockers and Contradictions
      try {
        const blockerQuery = `
          MATCH (f:Feature {state: 'blocked'})
          RETURN count(f) as blocked_features,
                 collect(f.name)[0..5] as blocked_names
        `;
        const contradictionQuery = `
          MATCH (a)-[r:CONTRADICTS]->(b)
          RETURN count(r) as contradiction_count
        `;

        const blockerResult = await service.executeCypher(blockerQuery, {}, 'READ');
        const contradictionResult = await service.executeCypher(contradictionQuery, {}, 'READ');

        const blockedCount = blockerResult && blockerResult.length > 0 && blockerResult[0] ? blockerResult[0]?.blocked_features || 0 : 0;
        const contradictionCount = contradictionResult && contradictionResult.length > 0 && contradictionResult[0] ? contradictionResult[0]?.contradiction_count || 0 : 0;

        const status = (blockedCount > 0 || contradictionCount > 0) ? '⚠️ ' : '✅';
        steps.push(`${status} **Step 4: Query Blockers and Contradictions**\n   Blocked features: ${blockedCount}, Contradictions: ${contradictionCount}`);
      } catch (error) {
        steps.push(`❌ **Step 4: Query Blockers and Contradictions**\n   Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Step 5: Load Active Feature Graph
      try {
        const featureQuery = `
          MATCH (f:Feature)
          WHERE f.state IN ['in_progress', 'planned']
          AND NOT EXISTS {
            MATCH (f)-[:REQUIRES]->(dep:Feature)
            WHERE dep.state <> 'complete'
          }
          RETURN count(f) as ready_features,
                 collect(f.name)[0..5] as feature_names
        `;
        const featureResult = await service.executeCypher(featureQuery, {}, 'READ');

        if (featureResult && featureResult.length > 0 && featureResult[0]) {
          const readyCount = featureResult[0]?.ready_features || 0;
          const featureNames = featureResult[0]?.feature_names || [];
          steps.push(`✅ **Step 5: Load Active Feature Graph**\n   ${readyCount} features ready to work on`);
          if (featureNames.length > 0) {
            steps.push(`   Next: ${featureNames.slice(0, 3).join(', ')}`);
          }
        } else {
          steps.push(`⚠️  **Step 5: Load Active Feature Graph**\n   No features ready`);
        }
      } catch (error) {
        steps.push(`❌ **Step 5: Load Active Feature Graph**\n   Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Step 6: Identify Next Priority Task
      try {
        const nextTaskQuery = `
          MATCH (f:Feature)
          WHERE f.state = 'planned'
          AND NOT EXISTS {
            MATCH (f)-[:REQUIRES]->(dep:Feature)
            WHERE dep.state <> 'complete'
          }
          RETURN f.name as name,
                 f.priority as priority,
                 f.estimated_effort as effort
          ORDER BY
            CASE f.priority
              WHEN 'critical' THEN 1
              WHEN 'high' THEN 2
              WHEN 'medium' THEN 3
              WHEN 'low' THEN 4
            END,
            f.created ASC
          LIMIT 1
        `;
        const nextTaskResult = await service.executeCypher(nextTaskQuery, {}, 'READ');

        if (nextTaskResult && nextTaskResult.length > 0 && nextTaskResult[0]) {
          const task = nextTaskResult[0];
          steps.push(`✅ **Step 6: Identify Next Priority Task**\n   ${task?.name} (${task?.priority} priority, ${task?.effort || 'unknown'} effort)`);
        } else {
          steps.push(`⚠️  **Step 6: Identify Next Priority Task**\n   No next task identified`);
        }
      } catch (error) {
        steps.push(`❌ **Step 6: Identify Next Priority Task**\n   Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      await service.close();

      output += steps.join('\n\n') + '\n\n';
      output += `=`.repeat(60) + '\n';
      output += `✨ Protocol Complete - Session Initialized\n\n`;
      output += `**Next Steps**:\n`;
      output += `1. Use \`query_next_task\` to see available work\n`;
      output += `2. Use \`update_feature_state\` to mark features in_progress\n`;
      output += `3. Use \`create_feature\` or \`create_test_contract\` to add new work\n`;

      return {
        content: [{ type: "text", text: output }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Startup Protocol Failed: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
}
