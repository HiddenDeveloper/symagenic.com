import { validateAgentsFile, checkRequiredAgents, REQUIRED_AGENTS } from './agents-schema.js';
import { SERVICE_PROVIDERS } from '../constants/message-constants.js';

/**
 * Test function to demonstrate required agent validation
 * This shows how the schema ensures critical agents exist
 */
export function testRequiredAgentValidation() {
  console.log('🧪 Testing Required Agent Validation\n');

  // Test case 1: Valid agents file with required agent
  console.log('Test 1: Valid agents file with AIlumina');
  const validAgents = {
    AIlumina: {
      service_provider: SERVICE_PROVIDERS.ANTHROPIC,
      model_name: 'claude-3-5-sonnet-20241022',
      description: 'Test AIlumina agent',
      system_prompt: 'You are AIlumina.',
      do_stream: false,
    },
    TestAgent: {
      service_provider: SERVICE_PROVIDERS.OPENAI,
      model_name: 'gpt-4',
      description: 'Test agent',
      system_prompt: 'You are a test agent.',
      do_stream: true,
    },
  };

  try {
    validateAgentsFile(validAgents);
    console.log('✅ Validation PASSED - All required agents present');
  } catch (error: unknown) {
    console.log('❌ Validation FAILED:', error instanceof Error ? error.message : String(error));
  }

  // Test case 2: Invalid agents file missing required agent
  console.log('\nTest 2: Invalid agents file missing AIlumina');
  const invalidAgents = {
    TestAgent: {
      service_provider: SERVICE_PROVIDERS.OPENAI,
      model_name: 'gpt-4',
      description: 'Test agent',
      system_prompt: 'You are a test agent.',
      do_stream: true,
    },
  };

  try {
    validateAgentsFile(invalidAgents);
    console.log('✅ Validation PASSED (unexpected!)');
  } catch (error: unknown) {
    console.log(
      '✅ Validation correctly FAILED:',
      error instanceof Error ? error.message : String(error)
    );
  }

  // Test case 3: Check required agents utility
  console.log('\nTest 3: Check required agents utility');
  const checkResult = checkRequiredAgents(invalidAgents);
  console.log(`Required agents check:`, checkResult);
  console.log(`Currently required agents: [${REQUIRED_AGENTS.join(', ')}]`);

  console.log('\n🎉 Required agent validation test completed!');
}

// Export for potential use in tests
export { REQUIRED_AGENTS };
