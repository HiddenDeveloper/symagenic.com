#!/usr/bin/env node

/**
 * Test different tool_result formats with Anthropic Claude API
 * This discovers what formats Claude actually accepts for tool results
 */

import Anthropic from '@anthropic-ai/sdk';

async function testToolResultFormat(formatName, toolResultCreator) {
  console.log(`\n🧪 Testing: ${formatName}`);
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('No ANTHROPIC_API_KEY found');
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    // Step 1: Get a tool_use response
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

    console.log('   📤 Requesting tool use...');
    const toolResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      tools: [weatherTool],
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check weather in Berlin' 
        }
      ]
    });

    const toolUseBlocks = toolResponse.content.filter(block => block.type === 'tool_use');
    if (toolUseBlocks.length === 0) {
      throw new Error('No tool_use blocks received');
    }

    const toolUse = toolUseBlocks[0];
    console.log('   ✅ Tool use received:', { id: toolUse.id, name: toolUse.name, input: toolUse.input });

    // Step 2: Simulate function execution
    const functionResult = `Weather in ${toolUse.input.location}: Partly cloudy, 19°C, light rain expected`;
    console.log('   ⚡ Function result:', functionResult);

    // Step 3: Test the specific format
    const toolResult = toolResultCreator(toolUse.id, functionResult);
    console.log('   📤 Tool result format:');
    console.log('   ', JSON.stringify(toolResult, null, 4));

    // Step 4: Continue conversation with tool result
    const continueResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check weather in Berlin' 
        },
        {
          role: 'assistant',
          content: toolResponse.content
        },
        {
          role: 'user',
          content: [toolResult]
        }
      ]
    });
    
    console.log(`   ✅ ${formatName} WORKS!`);
    console.log(`   📥 Claude response: ${continueResponse.content[0].text.substring(0, 120)}...`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ ${formatName} FAILED: ${error.message}`);
    return false;
  }
}

async function runAnthropicFormatTests() {
  console.log('🧪 Testing Anthropic Claude Tool Result Formats\n');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('❌ No ANTHROPIC_API_KEY environment variable found.');
    console.log('   Get a key from: https://console.anthropic.com/');
    process.exit(1);
  }

  console.log('Testing different tool_result formats to see which ones work...\n');

  const results = {};
  
  try {
    // Format 1: Standard tool_result with string content
    results.standard = await testToolResultFormat(
      'Standard tool_result (string content)',
      (toolUseId, result) => ({
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: result
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 2: Tool result with object content
    results.objectContent = await testToolResultFormat(
      'Tool_result with object content',
      (toolUseId, result) => ({
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: { result: result }
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 3: Tool result with array content
    results.arrayContent = await testToolResultFormat(
      'Tool_result with array content',
      (toolUseId, result) => ({
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: [result]
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 4: Missing tool_use_id (should fail)
    results.missingId = await testToolResultFormat(
      'Missing tool_use_id (should fail)',
      (toolUseId, result) => ({
        type: 'tool_result',
        content: result
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 5: Wrong tool_use_id (should fail)
    results.wrongId = await testToolResultFormat(
      'Wrong tool_use_id (should fail)',
      (toolUseId, result) => ({
        type: 'tool_result',
        tool_use_id: 'wrong_id_12345',
        content: result
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 6: Missing type field (should fail)
    results.missingType = await testToolResultFormat(
      'Missing type field (should fail)',
      (toolUseId, result) => ({
        tool_use_id: toolUseId,
        content: result
      })
    );

  } catch (error) {
    console.error('Test execution error:', error);
  }

  console.log('\n📊 RESULTS SUMMARY:');
  console.log('==================');
  Object.entries(results).forEach(([format, success]) => {
    console.log(`${success ? '✅' : '❌'} ${format}: ${success ? 'WORKS' : 'FAILED'}`);
  });

  const workingFormats = Object.entries(results).filter(([_, success]) => success).map(([format]) => format);
  
  if (workingFormats.length > 0) {
    console.log(`\n🎉 Working formats: ${workingFormats.join(', ')}`);
    
    if (workingFormats.includes('standard')) {
      console.log('\n✅ Our current implementation using standard tool_result is CORRECT!');
    } else {
      console.log('\n⚠️  Our implementation might need adjustments based on working formats');
    }
  } else {
    console.log('\n😞 No formats worked. There might be an API issue or all our formats are incorrect.');
  }
}

runAnthropicFormatTests().catch(console.error);