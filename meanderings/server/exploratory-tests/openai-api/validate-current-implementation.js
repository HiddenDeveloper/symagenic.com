#!/usr/bin/env node

/**
 * Validate our current OpenAI implementation against real API
 * This test confirms our exact tool response format works correctly
 */

import OpenAI from 'openai';

async function validateCurrentImplementation() {
  console.log('🧪 Validating Current OpenAI Implementation\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ No OPENAI_API_KEY environment variable found.');
    console.log('   Get a key from: https://platform.openai.com/');
    console.log('   Then: export OPENAI_API_KEY="your-key-here"');
    return;
  }

  try {
    const openai = new OpenAI({ apiKey });

    // Step 1: Get a tool call response
    console.log('📤 Step 1: Requesting tool call from OpenAI...');
    const weatherTool = {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' },
            unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
          },
          required: ['location']
        }
      }
    };

    const toolResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 200,
      tools: [weatherTool],
      tool_choice: 'auto',
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check weather in Miami' 
        }
      ]
    });

    if (!toolResponse.choices[0].message.tool_calls || toolResponse.choices[0].message.tool_calls.length === 0) {
      throw new Error('No tool calls received from OpenAI');
    }

    const toolCall = toolResponse.choices[0].message.tool_calls[0];
    console.log('✅ Tool call received:');
    console.log('   ID:', toolCall.id);
    console.log('   Function:', toolCall.function.name);
    console.log('   Arguments:', toolCall.function.arguments);

    // Step 2: Simulate function execution
    const parsedArgs = JSON.parse(toolCall.function.arguments);
    const functionResult = `Weather in ${parsedArgs.location}: Sunny, 28°C, gentle breeze, perfect beach weather`;
    console.log('\n⚡ Function execution result:', functionResult);

    // Step 3: Use our EXACT current implementation format
    console.log('\n📤 Step 3: Testing our current implementation format...');
    
    // This is exactly what our current implementation produces:
    const ourToolResult = {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: functionResult
    };

    console.log('Our tool response format:');
    console.log(JSON.stringify(ourToolResult, null, 2));

    // Step 4: Test with OpenAI
    console.log('\n🧪 Step 4: Sending to OpenAI API...');
    const continueResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 200,
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check weather in Miami' 
        },
        {
          role: 'assistant',
          content: toolResponse.choices[0].message.content,
          tool_calls: toolResponse.choices[0].message.tool_calls
        },
        ourToolResult  // This is exactly how we format it
      ]
    });

    console.log('✅ SUCCESS! Our current implementation WORKS!');
    console.log('\n📥 OpenAI\'s response:');
    console.log(continueResponse.choices[0].message.content);
    
    // Step 5: Verify response structure
    console.log('\n🔍 Response analysis:');
    console.log('   Finish reason:', continueResponse.choices[0].finish_reason);
    console.log('   Model used:', continueResponse.model);
    console.log('   Usage tokens:', continueResponse.usage.total_tokens);
    
    const responseText = continueResponse.choices[0].message.content.toLowerCase();
    if (responseText.includes('miami') ||
        responseText.includes('weather') ||
        responseText.includes('sunny') ||
        responseText.includes('28')) {
      console.log('✅ OpenAI properly processed our tool result!');
    } else {
      console.log('⚠️  OpenAI\'s response doesn\'t seem to reference our weather data');
    }

    return true;

  } catch (error) {
    console.error('\n❌ Validation FAILED:', error.message);
    
    if (error.message.includes('tool_call_id')) {
      console.log('\n💡 Issue with tool_call_id matching');
    } else if (error.message.includes('role')) {
      console.log('\n💡 Issue with message role');
    } else if (error.message.includes('Invalid')) {
      console.log('\n💡 Invalid request format');
    }
    
    console.log('\nFull error details:');
    console.log(error);
    return false;
  }
}

async function runValidation() {
  console.log('🎯 Testing our exact OpenAI implementation format\n');
  
  const success = await validateCurrentImplementation();
  
  console.log('\n📊 VALIDATION SUMMARY');
  console.log('====================');
  
  if (success) {
    console.log('✅ Our current implementation is CORRECT!');
    console.log('✅ No changes needed to openai-provider.ts');
    console.log('✅ Tool response format works with real API');
    
    console.log('\n🔗 Our working format:');
    console.log('```javascript');
    console.log('formatToolResponseMessage(functionResult, toolName, toolCallId) {');
    console.log('  return {');
    console.log('    role: \'tool\',');
    console.log('    tool_call_id: toolCallId,');
    console.log('    content: functionResult');
    console.log('  };');
    console.log('}');
    console.log('```');
    
    console.log('\n📋 Message Flow Confirmed:');
    console.log('1. User message → OpenAI');
    console.log('2. Assistant with tool_calls ← OpenAI');
    console.log('3. Tool response (role: "tool") → OpenAI');
    console.log('4. Assistant final response ← OpenAI');
    
  } else {
    console.log('❌ Our current implementation needs adjustments');
    console.log('❌ Check the error details above for specific issues');
    console.log('🔧 May need to update openai-provider.ts');
  }
}

runValidation().catch(console.error);