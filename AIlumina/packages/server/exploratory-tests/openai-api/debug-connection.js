#!/usr/bin/env node

/**
 * Debug basic OpenAI API connectivity and function calling
 * This test verifies we can connect to OpenAI and get tool calls
 */

import OpenAI from 'openai';

async function debugOpenAIConnection() {
  console.log('🧪 Debugging OpenAI API Connection\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ No OPENAI_API_KEY environment variable found.');
    console.log('   Get a key from: https://platform.openai.com/');
    console.log('   Then: export OPENAI_API_KEY="your-key-here"');
    return;
  }

  console.log('API Key present:', !!apiKey);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 7) + '...' : 'none');

  try {
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Test 1: Simple text generation (no tools)
    console.log('\n🧪 Test 1: Simple text generation');
    const simpleResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 50,
      messages: [
        { role: 'user', content: 'Say hello in one word' }
      ]
    });

    console.log('✅ Simple text response:', simpleResponse.choices[0].message.content);
    console.log('   Model used:', simpleResponse.model);
    console.log('   Usage:', simpleResponse.usage);

    // Test 2: Tool definition
    console.log('\n🧪 Test 2: Tool calling test');
    const weatherTool = {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA'
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'Temperature unit'
            }
          },
          required: ['location']
        }
      }
    };

    console.log('Tool definition:');
    console.log(JSON.stringify(weatherTool, null, 2));

    console.log('\n📤 Sending request with tool...');
    const toolResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 200,
      tools: [weatherTool],
      tool_choice: 'auto',
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather function to check the weather in Boston' 
        }
      ]
    });

    console.log('\n📥 Full response object:');
    console.log('Response message:', JSON.stringify(toolResponse.choices[0].message, null, 2));
    console.log('Finish reason:', toolResponse.choices[0].finish_reason);
    console.log('Usage:', toolResponse.usage);

    // Check for tool_calls
    const message = toolResponse.choices[0].message;
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log('\n✅ Tool calls found:');
      message.tool_calls.forEach((toolCall, index) => {
        console.log(`  Tool Call ${index + 1}:`, {
          id: toolCall.id,
          type: toolCall.type,
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          }
        });
        
        // Try to parse arguments
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`    Parsed arguments:`, args);
        } catch (e) {
          console.log(`    Arguments parsing failed:`, e.message);
        }
      });
    } else {
      console.log('\n❌ No tool_calls found in response');
      console.log('This might indicate the model chose not to use tools');
      
      if (message.content) {
        console.log('Text content instead:', message.content);
      }
    }

    // Test 3: Test with different model (GPT-4 if available)
    console.log('\n🧪 Test 3: Testing with GPT-4 model');
    try {
      const gpt4Response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        max_tokens: 100,
        tools: [weatherTool],
        messages: [
          { 
            role: 'user', 
            content: 'Get weather for Paris using the weather function' 
          }
        ]
      });

      console.log('✅ GPT-4 response received');
      console.log('   Model:', gpt4Response.model);
      console.log('   Has tool calls:', !!gpt4Response.choices[0].message.tool_calls);
      
      if (gpt4Response.choices[0].message.tool_calls) {
        console.log('   Tool call count:', gpt4Response.choices[0].message.tool_calls.length);
      }
      
    } catch (gpt4Error) {
      console.log('⚠️  GPT-4 test failed:', gpt4Error.message);
      if (gpt4Error.message.includes('model')) {
        console.log('   (GPT-4 may not be available on your account)');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('authentication') || error.message.includes('Incorrect API key')) {
      console.log('\n💡 Authentication issue - check your API key');
    } else if (error.message.includes('rate')) {
      console.log('\n💡 Rate limit hit - wait a moment and try again');
    } else if (error.message.includes('model')) {
      console.log('\n💡 Model issue - try a different model name');
    } else if (error.message.includes('billing')) {
      console.log('\n💡 Billing issue - check your OpenAI account billing');
    }
    
    console.log('\nFull error object:');
    console.log(error);
  }
}

debugOpenAIConnection().catch(console.error);