/**
 * Agent Lifecycle E2E Tests via Bridge MCP
 *
 * Tests the complete agent lifecycle through the Ailumina Bridge MCP:
 * 1. Create agent via bridge
 * 2. Verify agent appears in list
 * 3. Test agent functionality via chat
 * 4. Update agent configuration
 * 5. Delete agent
 *
 * These tests ensure agents can be managed programmatically without
 * manual agents.json editing, addressing the validation paradox.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Configuration
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3004';
const BRIDGE_AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN || 'Ez+Dyzqz8EehCOzczST8f3rdSyKFNZFQCSz25hp5jqc=';
const TEST_AGENT_KEY = 'TestAgentE2E';

// Helper to call bridge MCP tools via HTTP
async function callBridgeTool(toolName: string, parameters: any = {}) {
  const response = await fetch(`${BRIDGE_URL}/tools/${toolName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BRIDGE_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parameters }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bridge tool ${toolName} failed (${response.status}): ${errorText}`);
  }

  // Bridge returns format: {tool, result: [{type, text}], isError, timestamp}
  // We need to parse the JSON from result[0].text
  const bridgeResponse = await response.json();

  // If error at bridge level, throw
  if (bridgeResponse.isError) {
    const errorText = bridgeResponse.result[0]?.text || JSON.stringify(bridgeResponse);
    throw new Error(`Bridge tool ${toolName} error: ${errorText}`);
  }

  // Parse the actual tool result from the text field
  const resultText = bridgeResponse.result[0]?.text;
  if (!resultText) {
    throw new Error(`Bridge tool ${toolName} returned no result text`);
  }

  return JSON.parse(resultText);
}

describe('Agent Lifecycle via Bridge MCP (E2E)', () => {
  // Skip if services aren't running
  beforeAll(async () => {
    if (process.env.SKIP_E2E_TESTS) {
      console.log('Skipping E2E tests (SKIP_E2E_TESTS set)');
      return;
    }

    try {
      // Verify bridge is accessible
      const response = await fetch(`${BRIDGE_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${BRIDGE_AUTH_TOKEN}`,
        },
      });
      if (!response.ok) {
        throw new Error('Bridge health check failed');
      }
    } catch (error) {
      console.warn('Bridge not accessible, skipping E2E tests:', error);
      throw error;
    }
  }, 10000);

  // Cleanup: ensure test agent doesn't exist before tests
  beforeAll(async () => {
    try {
      await callBridgeTool('delete_agent', { agent_key: TEST_AGENT_KEY });
    } catch (error) {
      // Ignore if agent doesn't exist
    }
  });

  // Cleanup: remove test agent after all tests
  afterAll(async () => {
    try {
      await callBridgeTool('delete_agent', { agent_key: TEST_AGENT_KEY });
    } catch (error) {
      // Ignore cleanup failures
    }
  });

  describe('Agent Creation', () => {
    it('should create a new agent via bridge', async () => {
      const result = await callBridgeTool('create_agent', {
        agent_key: TEST_AGENT_KEY,
        config: {
          agent_name: 'E2E Test Agent',
          service_provider: 'OPENAI',
          model_name: 'gpt-4o-mini',
          description: 'Agent created via E2E test',
          system_prompt: 'You are a test agent. Respond concisely.',
          do_stream: false,
          available_functions: [],
          custom_settings: {},
          mcp_servers: [],
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain('created successfully');
    }, 15000);

    it('should list the newly created agent', async () => {
      const result = await callBridgeTool('list_agents');

      expect(result).toBeDefined();
      expect(result.agents).toBeDefined();
      expect(typeof result.agents).toBe('object');

      // Agents is an object keyed by agent_key
      const testAgent = result.agents[TEST_AGENT_KEY];
      expect(testAgent).toBeDefined();
      expect(testAgent.agent_name).toBe('E2E Test Agent');
      expect(testAgent.service_provider).toBe('OPENAI');
    }, 10000);

    it('should get specific agent details', async () => {
      const result = await callBridgeTool('get_agent', { agent_key: TEST_AGENT_KEY });

      expect(result).toBeDefined();
      expect(result.agent).toBeDefined();
      expect(result.agent.key).toBe(TEST_AGENT_KEY);
      expect(result.agent.agent_name).toBe('E2E Test Agent');
      expect(result.agent.model_name).toBe('gpt-4o-mini');
    }, 10000);
  });

  describe('Agent Functionality', () => {
    it('should be able to chat with the created agent', async () => {
      const result = await callBridgeTool('ailumina_chat', {
        agent_type: TEST_AGENT_KEY,
        user_input: 'Hello! Respond with just "OK" if you can read this.',
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
      // Agent should respond (exact content may vary)
    }, 30000);
  });

  describe('Agent Updates', () => {
    it('should update agent configuration', async () => {
      const result = await callBridgeTool('update_agent', {
        agent_key: TEST_AGENT_KEY,
        updates: {
          description: 'Updated E2E test agent',
          system_prompt: 'You are an updated test agent. Be even more concise.',
        },
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain('updated successfully');
    }, 10000);

    it('should reflect the updates in agent details', async () => {
      const result = await callBridgeTool('get_agent', { agent_key: TEST_AGENT_KEY });

      expect(result).toBeDefined();
      expect(result.agent.description).toBe('Updated E2E test agent');
      expect(result.agent.system_prompt).toContain('updated test agent');
    }, 10000);
  });

  describe('Agent Deletion', () => {
    it('should delete the agent', async () => {
      const result = await callBridgeTool('delete_agent', { agent_key: TEST_AGENT_KEY });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    }, 10000);

    it('should no longer list the deleted agent', async () => {
      const result = await callBridgeTool('list_agents');

      expect(result).toBeDefined();
      expect(result.agents).toBeDefined();

      // Agents is an object - check if test agent key doesn't exist
      const testAgent = result.agents[TEST_AGENT_KEY];
      expect(testAgent).toBeUndefined();
    }, 10000);

    it('should fail to get details of deleted agent', async () => {
      await expect(
        callBridgeTool('get_agent', { agent_key: TEST_AGENT_KEY })
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Validation', () => {
    it('should reject agent creation with invalid config', async () => {
      await expect(
        callBridgeTool('create_agent', {
          agent_key: 'InvalidAgent',
          config: {
            // Missing required fields
            agent_name: 'Invalid',
          },
        })
      ).rejects.toThrow();
    }, 10000);

    it('should reject agent creation with empty agent_key', async () => {
      await expect(
        callBridgeTool('create_agent', {
          agent_key: '',
          config: {
            agent_name: 'Test',
            service_provider: 'OPENAI',
            model_name: 'gpt-4o-mini',
            description: 'Test',
            system_prompt: 'Test',
            do_stream: false,
          },
        })
      ).rejects.toThrow();
    }, 10000);
  });
});
