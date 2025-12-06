#!/usr/bin/env node

/**
 * Debug basic Anthropic Claude API connectivity and tool calling
 * This test verifies we can connect to Claude and get tool_use responses
 */

import Anthropic from '@anthropic-ai/sdk';

async function debugAnthropicConnection() {
  console.log('🧪 Debugging Anthropic Claude API Connection\n');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('❌ No ANTHROPIC_API_KEY environment variable found.');
    console.log('   Get a key from: https://console.anthropic.com/');
    console.log('   Then: export ANTHROPIC_API_KEY="your-key-here"');
    return;
  }

  console.log('API Key present:', !!apiKey);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 15) + '...' : 'none');

  try {
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // Test 1: Simple text generation (no tools)
    console.log('\n🧪 Test 1: Simple text generation');
    const simpleResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      messages: [
        { role: 'user', content: 'Say hello in one word' }
      ]
    });

    console.log('✅ Simple text response:', simpleResponse.content[0].text);

    // Test 2: Tool definition
    console.log('\n🧪 Test 2: Tool calling test');
    const weatherTool = {
      name: 'get_weather',
      description: 'Get current weather for a location',
      input_schema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA'
          }
        },
        required: ['location']
      }
    };

    console.log('Tool definition:', JSON.stringify(weatherTool, null, 2));

    console.log('\n📤 Sending request with tool...');
    const toolResponse = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      tools: [weatherTool],
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check the weather in Seattle' 
        }
      ]
    });

    console.log('\n📥 Full response object:');
    console.log('Response content:', JSON.stringify(toolResponse.content, null, 2));
    console.log('Stop reason:', toolResponse.stop_reason);
    console.log('Usage:', toolResponse.usage);

    // Check for tool_use blocks
    const toolUseBlocks = toolResponse.content.filter(block => block.type === 'tool_use');
    if (toolUseBlocks.length > 0) {
      console.log('\n✅ Tool use blocks found:');
      toolUseBlocks.forEach((block, index) => {
        console.log(`  Tool ${index + 1}:`, {
          id: block.id,
          name: block.name,
          input: block.input
        });
      });
    } else {
      console.log('\n❌ No tool_use blocks found in response');
      console.log('This might indicate the model chose not to use tools');
    }

    // Check for text content
    const textBlocks = toolResponse.content.filter(block => block.type === 'text');
    if (textBlocks.length > 0) {
      console.log('\n📝 Text content:');
      textBlocks.forEach((block, index) => {
        console.log(`  Text ${index + 1}:`, block.text);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication issue - check your API key');
    } else if (error.message.includes('rate')) {
      console.log('\n💡 Rate limit hit - wait a moment and try again');
    } else if (error.message.includes('model')) {
      console.log('\n💡 Model issue - try a different model name');
    }
    
    console.log('\nFull error:', error);
  }
}

debugAnthropicConnection().catch(console.error);