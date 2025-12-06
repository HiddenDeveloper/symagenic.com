/**
 * Workflow Management Tools
 *
 * Implements Anthropic-inspired workflow patterns:
 * - Immutable test contracts
 * - Feature dependency graphs
 * - State machine transitions
 * - Startup protocols
 */

import { Neo4jService } from '../neo4j-service.js';
import type { Neo4jConfig, MemoryToolResponse } from '../types.js';

// ============================================================================
// Create Test Contract Tool
// ============================================================================

export interface CreateTestContractParams {
  name: string;
  description: string;
  test_type: 'unit' | 'integration' | 'e2e' | 'acceptance';
  acceptance_criteria: string;
  created_by: string;
  test_code_path?: string;
}

export class CreateTestContractTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: CreateTestContractParams): Promise<MemoryToolResponse> {
    try {
      const service = this.createService(config);

      // Check if test already exists
      const checkQuery = 'MATCH (tc:TestCase {name: $name}) RETURN tc';
      const existing = await service.executeCypher(checkQuery, { name: params.name }, 'READ');

      if (existing && existing.length > 0) {
        await service.close();
        return {
          content: [{
            type: "text",
            text: `❌ TestCase "${params.name}" already exists. TestCases are immutable and cannot be modified.`
          }],
          isError: true
        };
      }

      // Create test contract
      const createQuery = `
        CREATE (tc:TestCase {
          id: randomUUID(),
          name: $name,
          description: $description,
          test_type: $test_type,
          acceptance_criteria: $acceptance_criteria,
          created_by: $created_by,
          test_code_path: $test_code_path,
          immutable: true,
          locked: true,
          status: 'pending',
          created: datetime()
        })
        RETURN tc.id as id, tc.name as name
      `;

      const result = await service.executeCypher(createQuery, {
        name: params.name,
        description: params.description,
        test_type: params.test_type,
        acceptance_criteria: params.acceptance_criteria,
        created_by: params.created_by,
        test_code_path: params.test_code_path || null
      }, 'WRITE');

      await service.close();

      if (!result || result.length === 0) {
        return {
          content: [{
            type: "text",
            text: `❌ Failed to create test contract`
          }],
          isError: true
        };
      }

      const testId = result[0]?.id;
      const testName = result[0]?.name;

      return {
        content: [{
          type: "text",
          text: `✅ Test Contract Created

**Name**: ${testName}
**Type**: ${params.test_type}
**Status**: pending (immutable)

**Acceptance Criteria**: ${params.acceptance_criteria}

⚠️  This test contract is IMMUTABLE. It cannot be edited once created (Anthropic principle).

**Test ID**: ${testId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error creating test contract: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
}

// ============================================================================
// Create Feature Tool
// ============================================================================

export interface CreateFeatureParams {
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_effort?: 'xs' | 's' | 'm' | 'l' | 'xl';
  created_by: string;
  assigned_to?: string;
  depends_on?: string[];
  test_names?: string[];
}

export class CreateFeatureTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: CreateFeatureParams): Promise<MemoryToolResponse> {
    try {
      const service = this.createService(config);

      // Check if feature already exists
      const checkQuery = 'MATCH (f:Feature {name: $name}) RETURN f';
      const existing = await service.executeCypher(checkQuery, { name: params.name }, 'READ');

      if (existing && existing.length > 0) {
        await service.close();
        return {
          content: [{
            type: "text",
            text: `❌ Feature "${params.name}" already exists`
          }],
          isError: true
        };
      }

      // Create feature
      const createQuery = `
        CREATE (f:Feature {
          id: randomUUID(),
          name: $name,
          description: $description,
          state: 'planned',
          priority: $priority,
          estimated_effort: $estimated_effort,
          created_by: $created_by,
          assigned_to: $assigned_to,
          created: datetime()
        })
        RETURN f.id as id, f.name as name
      `;

      const result = await service.executeCypher(createQuery, {
        name: params.name,
        description: params.description,
        priority: params.priority,
        estimated_effort: params.estimated_effort || null,
        created_by: params.created_by,
        assigned_to: params.assigned_to || null
      }, 'WRITE');

      if (!result || result.length === 0) {
        await service.close();
        return {
          content: [{
            type: "text",
            text: `❌ Failed to create feature`
          }],
          isError: true
        };
      }

      const featureId = result[0]?.id;
      const featureName = result[0]?.name;

      // Link dependencies
      let dependenciesLinked = 0;
      if (params.depends_on && params.depends_on.length > 0) {
        for (const depName of params.depends_on) {
          const depQuery = `
            MATCH (f:Feature {name: $feature_name})
            MATCH (dep:Feature {name: $dep_name})
            CREATE (f)-[:REQUIRES {
              reason: 'Dependency specified at feature creation',
              created: datetime()
            }]->(dep)
            RETURN count(*) as linked
          `;
          const depResult = await service.executeCypher(depQuery, {
            feature_name: params.name,
            dep_name: depName
          }, 'WRITE');
          if (depResult && depResult.length > 0 && depResult[0]) {
            dependenciesLinked += depResult[0].linked || 0;
          }
        }
      }

      // Link test contracts
      let testsLinked = 0;
      if (params.test_names && params.test_names.length > 0) {
        for (const testName of params.test_names) {
          const testQuery = `
            MATCH (f:Feature {name: $feature_name})
            MATCH (tc:TestCase {name: $test_name})
            CREATE (f)-[:SATISFIES {created: datetime()}]->(tc)
            CREATE (tc)-[:VALIDATES {created: datetime()}]->(f)
            RETURN count(*) as linked
          `;
          const testResult = await service.executeCypher(testQuery, {
            feature_name: params.name,
            test_name: testName
          }, 'WRITE');
          if (testResult && testResult.length > 0 && testResult[0]) {
            testsLinked += (testResult[0].linked || 0) / 2; // Divided by 2 because we create 2 relationships
          }
        }
      }

      await service.close();

      let output = `✅ Feature Created

**Name**: ${featureName}
**Priority**: ${params.priority}
**State**: planned
**Effort**: ${params.estimated_effort || 'not estimated'}
`;

      if (dependenciesLinked > 0) {
        output += `\n**Dependencies**: ${dependenciesLinked} feature(s) linked`;
      }

      if (testsLinked > 0) {
        output += `\n**Tests**: ${testsLinked} test contract(s) linked`;
      }

      output += `\n\n**Feature ID**: ${featureId}`;

      return {
        content: [{ type: "text", text: output }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error creating feature: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
}

// ============================================================================
// Query Next Task Tool
// ============================================================================

export interface QueryNextTaskParams {
  priority_filter?: 'critical' | 'high' | 'medium' | 'low';
  assigned_to_filter?: string;
  limit?: number;
}

export class QueryNextTaskTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: QueryNextTaskParams = {}): Promise<MemoryToolResponse> {
    try {
      const service = this.createService(config);

      const priorityFilter = params.priority_filter ? `AND f.priority = $priority` : '';
      const assignedFilter = params.assigned_to_filter ? `AND f.assigned_to = $assigned_to` : '';
      const limit = params.limit || 5;

      const query = `
        MATCH (f:Feature)
        WHERE f.state = 'planned'
        ${priorityFilter}
        ${assignedFilter}
        AND NOT EXISTS {
          MATCH (f)-[:REQUIRES]->(dep:Feature)
          WHERE dep.state <> 'complete'
        }
        OPTIONAL MATCH (f)-[:SATISFIES]->(tc:TestCase)
        WITH f, collect(tc.name) as test_names
        RETURN f.name as name,
               f.description as description,
               f.priority as priority,
               f.state as state,
               f.estimated_effort as effort,
               test_names
        ORDER BY
          CASE f.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          f.created ASC
        LIMIT $limit
      `;

      const result = await service.executeCypher(query, {
        priority: params.priority_filter || null,
        assigned_to: params.assigned_to_filter || null,
        limit
      }, 'READ');

      await service.close();

      if (!result || result.length === 0) {
        return {
          content: [{
            type: "text",
            text: `📋 No Tasks Ready

All features are either blocked by dependencies or already complete.

Use \`create_feature\` to add new features.`
          }]
        };
      }

      let output = `📋 Next Tasks (${result.length} ready)\n\n`;

      result.forEach((task, i) => {
        output += `${i + 1}. **${task.name}**\n`;
        output += `   Priority: ${task.priority} | Effort: ${task.effort || 'unknown'}\n`;
        output += `   ${task.description}\n`;
        if (task.test_names && task.test_names.length > 0) {
          output += `   Tests: ${task.test_names.length} test contract(s)\n`;
        }
        output += `\n`;
      });

      output += `💡 Use \`update_feature_state\` to mark features as 'in_progress' when starting work.`;

      return {
        content: [{ type: "text", text: output }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error querying next task: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
}

// ============================================================================
// Update Feature State Tool
// ============================================================================

export interface UpdateFeatureStateParams {
  feature_name: string;
  new_state: 'planned' | 'in_progress' | 'implemented' | 'tested' | 'complete' | 'blocked';
  updated_by: string;
  blocker_reason?: string;
}

export class UpdateFeatureStateTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: UpdateFeatureStateParams): Promise<MemoryToolResponse> {
    try {
      const service = this.createService(config);

      // Check current state and dependencies
      const checkQuery = `
        MATCH (f:Feature {name: $feature_name})
        OPTIONAL MATCH (f)-[:REQUIRES]->(dep:Feature)
        WHERE dep.state <> 'complete'
        RETURN f.state as current_state, collect(dep.name) as incomplete_deps
      `;

      const checkResult = await service.executeCypher(checkQuery, {
        feature_name: params.feature_name
      }, 'READ');

      if (!checkResult || checkResult.length === 0) {
        await service.close();
        return {
          content: [{
            type: "text",
            text: `❌ Feature "${params.feature_name}" not found`
          }],
          isError: true
        };
      }

      const currentState = checkResult[0]?.current_state;
      const incompleteDeps = checkResult[0]?.incomplete_deps || [];
      const warnings: string[] = [];

      // Warn about incomplete dependencies
      if (params.new_state === 'in_progress' && incompleteDeps.length > 0) {
        warnings.push(`⚠️  ${incompleteDeps.length} incomplete dependencies: ${incompleteDeps.join(', ')}`);
      }

      // Check tests if marking complete
      if (params.new_state === 'complete') {
        const testQuery = `
          MATCH (f:Feature {name: $feature_name})-[:SATISFIES]->(tc:TestCase)
          WHERE tc.status <> 'passing'
          RETURN count(tc) as failing_tests, collect(tc.name) as failing_test_names
        `;

        const testResult = await service.executeCypher(testQuery, {
          feature_name: params.feature_name
        }, 'READ');

        if (testResult && testResult.length > 0 && testResult[0]) {
          const failingTests = testResult[0].failing_tests || 0;
          const failingTestNames = testResult[0].failing_test_names || [];

          if (failingTests > 0) {
            await service.close();
            return {
              content: [{
                type: "text",
                text: `❌ Cannot mark feature complete

${failingTests} test(s) not passing:
${failingTestNames.map((name: string) => `  • ${name}`).join('\n')}

Mark tests as passing with \`update_test_status\` first.`
              }],
              isError: true
            };
          }
        }
      }

      // Update state
      const updateQuery = params.new_state === 'blocked'
        ? `
          MATCH (f:Feature {name: $feature_name})
          SET f.state = $new_state,
              f.last_state_update = datetime(),
              f.last_updated_by = $updated_by,
              f.blocker_reason = $blocker_reason
          RETURN f.state as new_state
          `
        : params.new_state === 'complete'
        ? `
          MATCH (f:Feature {name: $feature_name})
          SET f.state = $new_state,
              f.completed = datetime(),
              f.last_state_update = datetime(),
              f.last_updated_by = $updated_by
          RETURN f.state as new_state
          `
        : `
          MATCH (f:Feature {name: $feature_name})
          SET f.state = $new_state,
              f.last_state_update = datetime(),
              f.last_updated_by = $updated_by
          RETURN f.state as new_state
          `;

      await service.executeCypher(updateQuery, {
        feature_name: params.feature_name,
        new_state: params.new_state,
        updated_by: params.updated_by,
        blocker_reason: params.blocker_reason || null
      }, 'WRITE');

      await service.close();

      let output = `✅ Feature State Updated

**Feature**: ${params.feature_name}
**Previous State**: ${currentState}
**New State**: ${params.new_state}
`;

      if (warnings.length > 0) {
        output += `\n${warnings.join('\n')}`;
      }

      return {
        content: [{ type: "text", text: output }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error updating feature state: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
}

// ============================================================================
// Update Test Status Tool
// ============================================================================

export interface UpdateTestStatusParams {
  test_name: string;
  status: 'pending' | 'passing' | 'failing';
  updated_by: string;
  reason?: string;
}

export class UpdateTestStatusTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig, params: UpdateTestStatusParams): Promise<MemoryToolResponse> {
    try {
      const service = this.createService(config);

      const query = `
        MATCH (tc:TestCase {name: $test_name})
        SET tc.status = $new_status,
            tc.last_status_update = datetime(),
            tc.last_updated_by = $updated_by,
            tc.status_reason = $reason
        RETURN tc.status as new_status
      `;

      const result = await service.executeCypher(query, {
        test_name: params.test_name,
        new_status: params.status,
        updated_by: params.updated_by,
        reason: params.reason || null
      }, 'WRITE');

      await service.close();

      if (!result || result.length === 0) {
        return {
          content: [{
            type: "text",
            text: `❌ TestCase "${params.test_name}" not found`
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: "text",
          text: `✅ Test Status Updated

**Test**: ${params.test_name}
**New Status**: ${params.status}
${params.reason ? `**Reason**: ${params.reason}` : ''}

⚠️  Remember: TestCases are IMMUTABLE. Only status can be updated.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Error updating test status: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
}
