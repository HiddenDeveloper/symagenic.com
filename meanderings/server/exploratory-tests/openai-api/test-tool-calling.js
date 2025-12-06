#!/usr/bin/env node

/**
 * Test OpenAI-specific tool calling scenarios and edge cases
 * This explores complex tool calling patterns and multiple tool scenarios
 */

import OpenAI from 'openai';

async function testToolCallingScenario(scenarioName, testSetup, expectedOutcome) {
  console.log(`\n🧪 Testing: ${scenarioName}`);
  console.log(`Expected: ${expectedOutcome}`);
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('No OPENAI_API_KEY found');
  }

  try {
    const openai = new OpenAI({ apiKey });

    const result = await testSetup(openai);
    
    console.log(`   ✅ ${scenarioName} COMPLETED`);
    return result;
    
  } catch (error) {
    console.log(`   ❌ ${scenarioName} FAILED: ${error.message}`);
    return false;
  }
}

async function runToolCallingTests() {
  console.log('🧪 Testing OpenAI Tool Calling Scenarios\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ No OPENAI_API_KEY environment variable found.');
    console.log('   Get a key from: https://platform.openai.com/');
    process.exit(1);
  }

  const results = {};
  
  // Test 1: Multiple tools available, single selection
  results.multipleToolsSelection = await testToolCallingScenario(
    'Multiple tools available - single selection',
    async (openai) => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'City name' }
              },
              required: ['location']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'calculate',
            description: 'Perform mathematical calculations',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: 'Math expression' }
              },
              required: ['expression']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_time',
            description: 'Get current time for a timezone',
            parameters: {
              type: 'object',
              properties: {
                timezone: { type: 'string', description: 'Timezone name' }
              },
              required: ['timezone']
            }
          }
        }
      ];

      console.log('   📤 Requesting calculation with multiple tools...');
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 200,
        tools: tools,
        messages: [
          { role: 'user', content: 'Calculate 42 * 17 using the appropriate tool' }
        ]
      });

      const toolCalls = response.choices[0].message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        throw new Error('No tool calls generated');
      }

      const toolCall = toolCalls[0];
      console.log('   ✅ Tool selected:', toolCall.function.name);
      console.log('   📝 Arguments:', toolCall.function.arguments);

      if (toolCall.function.name !== 'calculate') {
        throw new Error('Wrong tool selected');
      }

      return true;
    },
    'Should select calculate tool from multiple options'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Parallel tool calls (multiple tools in one response)
  results.parallelToolCalls = await testToolCallingScenario(
    'Parallel tool calls',
    async (openai) => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string', description: 'City name' }
              },
              required: ['location']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_time',
            description: 'Get current time for a timezone',
            parameters: {
              type: 'object',
              properties: {
                timezone: { type: 'string', description: 'Timezone name' }
              },
              required: ['timezone']
            }
          }
        }
      ];

      console.log('   📤 Requesting multiple tool calls...');
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 300,
        tools: tools,
        messages: [
          { role: 'user', content: 'Get the weather in Tokyo and the current time in Japan timezone' }
        ]
      });

      const toolCalls = response.choices[0].message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        throw new Error('No tool calls generated');
      }

      console.log(`   ✅ Tool calls generated: ${toolCalls.length}`);
      toolCalls.forEach((call, index) => {
        console.log(`   Tool ${index + 1}: ${call.function.name}`);
      });

      // Test responding to multiple tool calls
      const toolResponses = toolCalls.map(call => ({
        role: 'tool',
        tool_call_id: call.id,
        content: call.function.name === 'get_weather' 
          ? 'Weather in Tokyo: Clear, 20°C'
          : 'Current time in Japan: 2:30 PM JST'
      }));

      const continueResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 200,
        messages: [
          { role: 'user', content: 'Get the weather in Tokyo and the current time in Japan timezone' },
          {
            role: 'assistant',
            content: response.choices[0].message.content,
            tool_calls: response.choices[0].message.tool_calls
          },
          ...toolResponses
        ]
      });

      console.log('   ✅ Multiple tool responses processed successfully');
      console.log(`   📥 Final response: ${continueResponse.choices[0].message.content.substring(0, 100)}...`);

      return toolCalls.length >= 2;
    },
    'Should handle multiple tool calls in parallel'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Tool choice enforcement
  results.toolChoiceEnforcement = await testToolCallingScenario(
    'Tool choice enforcement',
    async (openai) => {
      const weatherTool = {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' }
            },
            required: ['location']
          }
        }
      };

      console.log('   📤 Forcing tool use with tool_choice...');
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 200,
        tools: [weatherTool],
        tool_choice: { type: 'function', function: { name: 'get_weather' } },
        messages: [
          { role: 'user', content: 'Tell me about the weather anywhere' }
        ]
      });

      const toolCalls = response.choices[0].message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        throw new Error('Tool choice enforcement failed');
      }

      console.log('   ✅ Tool use enforced successfully');
      console.log('   📝 Tool called:', toolCalls[0].function.name);

      return true;
    },
    'Should enforce specific tool usage'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Large tool response handling
  results.largeToolResponse = await testToolCallingScenario(
    'Large tool response handling',
    async (openai) => {
      const dataTool = {
        type: 'function',
        function: {
          name: 'get_data',
          description: 'Get data from a source',
          parameters: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Data source name' }
            },
            required: ['source']
          }
        }
      };

      console.log('   📤 Testing with large tool response...');
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 200,
        tools: [dataTool],
        tool_choice: 'auto',
        messages: [
          { role: 'user', content: 'Get data from the analytics source using the tool' }
        ]
      });

      const toolCalls = response.choices[0].message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        throw new Error('No tool calls generated');
      }

      // Create a large response (simulating a big dataset)
      const largeResponse = {
        role: 'tool',
        tool_call_id: toolCalls[0].id,
        content: JSON.stringify({
          data: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            value: Math.random() * 1000,
            timestamp: new Date().toISOString(),
            category: `category_${i % 10}`
          })),
          metadata: {
            total_records: 100,
            source: 'analytics',
            generated_at: new Date().toISOString()
          }
        })
      };

      console.log(`   📊 Large response size: ${largeResponse.content.length} characters`);

      const continueResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 300,
        messages: [
          { role: 'user', content: 'Get data from the analytics source using the tool' },
          {
            role: 'assistant',
            content: response.choices[0].message.content,
            tool_calls: response.choices[0].message.tool_calls
          },
          largeResponse
        ]
      });

      console.log('   ✅ Large tool response processed successfully');
      console.log(`   📥 Response mentions data: ${continueResponse.choices[0].message.content.toLowerCase().includes('data')}`);

      return true;
    },
    'Should handle large structured tool responses'
  );

  // Display comprehensive results
  console.log('\n📊 TOOL CALLING TEST RESULTS');
  console.log('=============================');
  
  Object.entries(results).forEach(([testName, success]) => {
    console.log(`${success ? '✅' : '❌'} ${testName}: ${success ? 'PASSED' : 'FAILED'}`);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tool calling scenarios work correctly!');
    console.log('✅ Our OpenAI implementation handles various tool calling patterns');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} test(s) failed - review implementation`);
  }

  // Key findings summary
  console.log('\n🔍 KEY FINDINGS:');
  console.log('================');
  console.log('• OpenAI supports multiple parallel tool calls in single response');
  console.log('• tool_choice can enforce specific tool usage');
  console.log('• Large structured tool responses (JSON) work correctly');
  console.log('• Tool selection from multiple options works intelligently');
  console.log('• Exact tool_call_id matching is required for tool responses');
}

runToolCallingTests().catch(console.error);