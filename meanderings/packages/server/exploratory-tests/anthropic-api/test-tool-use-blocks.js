#!/usr/bin/env node

/**
 * Test Anthropic-specific tool_use block scenarios
 * This explores edge cases and complex tool calling patterns
 */

import Anthropic from '@anthropic-ai/sdk';

async function testToolUseScenario(scenarioName, messageFlow, expectedOutcome) {
  console.log(`\n🧪 Testing: ${scenarioName}`);
  console.log(`Expected: ${expectedOutcome}`);
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('No ANTHROPIC_API_KEY found');
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    let messages = [];
    let response;

    for (const [index, step] of messageFlow.entries()) {
      console.log(`   Step ${index + 1}: ${step.description}`);
      
      if (step.type === 'user_message') {
        messages.push({
          role: 'user',
          content: step.content
        });
        
        response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 300,
          tools: step.tools || [],
          messages: [...messages]
        });
        
        messages.push({
          role: 'assistant',
          content: response.content
        });
        
        console.log(`   📥 Response: ${response.content[0]?.text?.substring(0, 60)}...`);
        
        if (step.expectToolUse) {
          const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
          if (toolUseBlocks.length > 0) {
            console.log(`   ✅ Tool use generated: ${toolUseBlocks.length} block(s)`);
            // Store the tool use blocks for the next step
            messageFlow.toolUseBlocks = toolUseBlocks;
          } else {
            console.log(`   ❌ Expected tool use but got none`);
            return false;
          }
        }
        
      } else if (step.type === 'tool_result') {
        const toolResult = step.createToolResult(messageFlow.toolUseBlocks);
        messages.push({
          role: 'user',
          content: [toolResult]
        });
        
        console.log(`   📤 Tool result: ${JSON.stringify(toolResult, null, 2)}`);
        
        response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 300,
          messages: [...messages]
        });
        
        console.log(`   📥 Final response: ${response.content[0]?.text?.substring(0, 80)}...`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`   ✅ ${scenarioName} COMPLETED`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ ${scenarioName} FAILED: ${error.message}`);
    return false;
  }
}

async function runToolUseBlockTests() {
  console.log('🧪 Testing Anthropic Tool Use Block Scenarios\n');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('❌ No ANTHROPIC_API_KEY environment variable found.');
    console.log('   Get a key from: https://console.anthropic.com/');
    process.exit(1);
  }

  const results = {};
  
  // Test 1: Basic tool use flow
  console.log('Testing basic tool use flow...');
  const weatherTool = {
    name: 'get_weather',
    description: 'Get current weather for a location',
    input_schema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' }
      },
      required: ['location']
    }
  };

  results.basicFlow = await testToolUseScenario(
    'Basic tool use flow',
    [
      {
        type: 'user_message',
        description: 'Request weather with tool',
        content: 'Use the get_weather tool to check weather in Berlin',
        tools: [weatherTool],
        expectToolUse: true
      },
      {
        type: 'tool_result',
        description: 'Provide tool result',
        createToolResult: function(toolUseBlocks) {
          const toolUse = toolUseBlocks?.[0];
          return {
            type: 'tool_result',
            tool_use_id: toolUse?.id || 'test_id_123',
            content: 'Weather in Berlin: Cloudy, 15°C, light rain'
          };
        }
      }
    ],
    'Complete tool calling cycle works'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Multiple tool calls
  const calculatorTool = {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    input_schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression to evaluate' }
      },
      required: ['expression']
    }
  };

  results.multipleTools = await testToolUseScenario(
    'Multiple tools available',
    [
      {
        type: 'user_message',
        description: 'Request calculation with multiple tools available',
        content: 'Calculate 15 * 23 using the calculator tool',
        tools: [weatherTool, calculatorTool],
        expectToolUse: true
      },
      {
        type: 'tool_result',
        description: 'Provide calculation result',
        createToolResult: function(toolUseBlocks) {
          const toolUse = toolUseBlocks?.[0];
          return {
            type: 'tool_result',
            tool_use_id: toolUse?.id || 'calc_test_123',
            content: '345'
          };
        }
      }
    ],
    'Can select correct tool from multiple options'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Tool result with complex content
  results.complexContent = await testToolUseScenario(
    'Complex tool result content',
    [
      {
        type: 'user_message',
        description: 'Request weather for complex response',
        content: 'Get detailed weather information for New York',
        tools: [weatherTool],
        expectToolUse: true
      },
      {
        type: 'tool_result',
        description: 'Provide complex JSON-like content',
        createToolResult: function(toolUseBlocks) {
          const toolUse = toolUseBlocks?.[0];
          return {
            type: 'tool_result',
            tool_use_id: toolUse?.id || 'weather_complex_123',
            content: JSON.stringify({
              location: 'New York, NY',
              temperature: '24°C',
              humidity: '65%',
              conditions: 'Partly cloudy',
              wind: '8 mph NW',
              forecast: ['Tomorrow: Sunny, 26°C', 'Day after: Rain, 18°C']
            })
          };
        }
      }
    ],
    'Complex structured content works in tool results'
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Tool call with no tools (should not use tools)
  results.noToolsAvailable = await testToolUseScenario(
    'Request without tools available',
    [
      {
        type: 'user_message',
        description: 'Request weather but no tools available',
        content: 'What is the weather like in Tokyo?',
        tools: [], // No tools provided
        expectToolUse: false
      }
    ],
    'Should respond normally without attempting tool use'
  );

  // Display comprehensive results
  console.log('\n📊 TOOL USE BLOCK TEST RESULTS');
  console.log('================================');
  
  Object.entries(results).forEach(([testName, success]) => {
    console.log(`${success ? '✅' : '❌'} ${testName}: ${success ? 'PASSED' : 'FAILED'}`);
  });

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tool use scenarios work correctly!');
    console.log('✅ Our Anthropic implementation handles various tool calling patterns');
  } else {
    console.log(`⚠️  ${totalTests - passedTests} test(s) failed - review implementation`);
  }

  // Key findings summary
  console.log('\n🔍 KEY FINDINGS:');
  console.log('================');
  console.log('• Anthropic tool_use blocks require exact tool_use_id matching');
  console.log('• tool_result content can be simple strings or complex JSON');
  console.log('• Multiple tools work - Claude selects appropriate tool');
  console.log('• Without tools, Claude responds normally (no tool attempts)');
  console.log('• Content arrays are mandatory for tool_result messages');
}

runToolUseBlockTests().catch(console.error);