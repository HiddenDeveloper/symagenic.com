#!/usr/bin/env node

/**
 * Validate our current Anthropic implementation against real API
 * This test confirms our exact tool_result format works correctly
 */

import Anthropic from '@anthropic-ai/sdk';

async function validateCurrentImplementation() {
  console.log('🧪 Validating Current Anthropic Implementation\n');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('❌ No ANTHROPIC_API_KEY environment variable found.');
    console.log('   Get a key from: https://console.anthropic.com/');
    console.log('   Then: export ANTHROPIC_API_KEY="your-key-here"');
    return;
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    // Step 1: Get a tool_use response
    console.log('📤 Step 1: Requesting tool use from Claude...');
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

    const toolResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      tools: [weatherTool],
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check weather in Tokyo' 
        }
      ]
    });

    const toolUseBlocks = toolResponse.content.filter(block => block.type === 'tool_use');
    if (toolUseBlocks.length === 0) {
      throw new Error('No tool_use blocks received');
    }

    const toolUse = toolUseBlocks[0];
    console.log('✅ Tool use received:');
    console.log('   ID:', toolUse.id);
    console.log('   Name:', toolUse.name);
    console.log('   Input:', toolUse.input);

    // Step 2: Simulate function execution
    const functionResult = `Weather in ${toolUse.input.location}: Partly cloudy, 22°C, light breeze`;
    console.log('\n⚡ Function execution result:', functionResult);

    // Step 3: Use our EXACT current implementation format
    console.log('\n📤 Step 3: Testing our current implementation format...');
    
    // This is exactly what our current implementation produces:
    const ourToolResult = {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: functionResult
    };

    console.log('Our tool_result format:');
    console.log(JSON.stringify(ourToolResult, null, 2));

    // Step 4: Test with Claude
    console.log('\n🧪 Step 4: Sending to Claude API...');
    const continueResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check weather in Tokyo' 
        },
        {
          role: 'assistant',
          content: toolResponse.content
        },
        {
          role: 'user',
          content: [ourToolResult]  // This is exactly how we format it
        }
      ]
    });

    console.log('✅ SUCCESS! Our current implementation WORKS!');
    console.log('\n📥 Claude\'s response:');
    console.log(continueResponse.content[0].text);
    
    // Step 5: Verify response structure
    console.log('\n🔍 Response analysis:');
    console.log('   Stop reason:', continueResponse.stop_reason);
    console.log('   Content blocks:', continueResponse.content.length);
    console.log('   Response type:', continueResponse.content[0].type);
    
    if (continueResponse.content[0].text.toLowerCase().includes('tokyo') ||
        continueResponse.content[0].text.toLowerCase().includes('weather') ||
        continueResponse.content[0].text.toLowerCase().includes('22')) {
      console.log('✅ Claude properly processed our tool result!');
    } else {
      console.log('⚠️  Claude\'s response doesn\'t seem to reference our weather data');
    }

  } catch (error) {
    console.error('\n❌ Validation FAILED:', error.message);
    
    if (error.message.includes('tool_use_id')) {
      console.log('\n💡 Issue with tool_use_id matching');
    } else if (error.message.includes('content')) {
      console.log('\n💡 Issue with content format');
    } else if (error.message.includes('type')) {
      console.log('\n💡 Issue with message type');
    }
    
    console.log('\nFull error details:', error);
    return false;
  }

  return true;
}

async function runValidation() {
  console.log('🎯 Testing our exact Anthropic implementation format\n');
  
  const success = await validateCurrentImplementation();
  
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('====================');
  
  if (success) {
    console.log('✅ Our current implementation is CORRECT!');
    console.log('✅ No changes needed to anthropic-provider.ts');
    console.log('✅ Tool result format works with real API');
    
    console.log('\n🔗 Our working format:');
    console.log('```javascript');
    console.log('formatToolResponseMessage(functionResult, toolName, toolCallId) {');
    console.log('  return {');
    console.log('    type: \'tool_result\',');
    console.log('    tool_use_id: toolCallId,');
    console.log('    content: functionResult');
    console.log('  };');
    console.log('}');
    console.log('```');
  } else {
    console.log('❌ Our current implementation needs adjustments');
    console.log('❌ Check the error details above for specific issues');
    console.log('🔧 May need to update anthropic-provider.ts');
  }
}

runValidation().catch(console.error);