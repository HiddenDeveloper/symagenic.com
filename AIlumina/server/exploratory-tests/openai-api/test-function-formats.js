#!/usr/bin/env node

/**
 * Test different tool response formats with OpenAI API
 * This discovers what formats OpenAI actually accepts for tool responses
 */

import OpenAI from 'openai';

async function testToolResponseFormat(formatName, toolResponseCreator) {
  console.log(`\n🧪 Testing: ${formatName}`);
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('No OPENAI_API_KEY found');
  }

  try {
    const openai = new OpenAI({ apiKey });

    // Step 1: Get a tool call response
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

    console.log('   📤 Requesting tool call...');
    const toolResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 200,
      tools: [weatherTool],
      tool_choice: 'auto',
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check weather in London' 
        }
      ]
    });

    if (!toolResponse.choices[0].message.tool_calls || toolResponse.choices[0].message.tool_calls.length === 0) {
      throw new Error('No tool calls received');
    }

    const toolCall = toolResponse.choices[0].message.tool_calls[0];
    console.log('   ✅ Tool call received:', { id: toolCall.id, name: toolCall.function.name });

    // Step 2: Simulate function execution
    const parsedArgs = JSON.parse(toolCall.function.arguments);
    const functionResult = `Weather in ${parsedArgs.location}: Rainy, 12°C, strong winds expected`;
    console.log('   ⚡ Function result:', functionResult);

    // Step 3: Test the specific format
    const toolResultMessage = toolResponseCreator(toolCall.id, functionResult, toolCall.function.name);
    console.log('   📤 Tool response format:');
    console.log('   ', JSON.stringify(toolResultMessage, null, 4));

    // Step 4: Continue conversation with tool result
    const continueResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 200,
      messages: [
        { 
          role: 'user', 
          content: 'Use the get_weather tool to check weather in London' 
        },
        {
          role: 'assistant',
          content: toolResponse.choices[0].message.content,
          tool_calls: toolResponse.choices[0].message.tool_calls
        },
        toolResultMessage
      ]
    });
    
    console.log(`   ✅ ${formatName} WORKS!`);
    console.log(`   📥 OpenAI response: ${continueResponse.choices[0].message.content.substring(0, 120)}...`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ ${formatName} FAILED: ${error.message}`);
    return false;
  }
}

async function runOpenAIFormatTests() {
  console.log('🧪 Testing OpenAI Tool Response Formats\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ No OPENAI_API_KEY environment variable found.');
    console.log('   Get a key from: https://platform.openai.com/');
    process.exit(1);
  }

  console.log('Testing different tool response formats to see which ones work...\n');

  const results = {};
  
  try {
    // Format 1: Modern tool response (our current implementation)
    results.modernTool = await testToolResponseFormat(
      'Modern tool response (our implementation)',
      (toolCallId, result, functionName) => ({
        role: 'tool',
        tool_call_id: toolCallId,
        content: result
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 2: Legacy function response
    results.legacyFunction = await testToolResponseFormat(
      'Legacy function response',
      (toolCallId, result, functionName) => ({
        role: 'function',
        name: functionName,
        content: result
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 3: Tool response with object content
    results.objectContent = await testToolResponseFormat(
      'Tool response with object content',
      (toolCallId, result, functionName) => ({
        role: 'tool',
        tool_call_id: toolCallId,
        content: JSON.stringify({ result: result, status: 'success' })
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 4: Missing tool_call_id (should fail)
    results.missingId = await testToolResponseFormat(
      'Missing tool_call_id (should fail)',
      (toolCallId, result, functionName) => ({
        role: 'tool',
        content: result
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 5: Wrong tool_call_id (should fail)
    results.wrongId = await testToolResponseFormat(
      'Wrong tool_call_id (should fail)',
      (toolCallId, result, functionName) => ({
        role: 'tool',
        tool_call_id: 'wrong_id_12345',
        content: result
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 6: Assistant role (wrong)
    results.assistantRole = await testToolResponseFormat(
      'Assistant role (should fail)',
      (toolCallId, result, functionName) => ({
        role: 'assistant',
        content: result
      })
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Format 7: User role (wrong)
    results.userRole = await testToolResponseFormat(
      'User role (should fail)',
      (toolCallId, result, functionName) => ({
        role: 'user',
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
    
    if (workingFormats.includes('modernTool')) {
      console.log('\n✅ Our current implementation using modern tool format is CORRECT!');
    } else if (workingFormats.includes('legacyFunction')) {
      console.log('\n⚠️  Only legacy function format works - we may need to support both');
    } else {
      console.log('\n⚠️  Our implementation might need adjustments based on working formats');
    }
  } else {
    console.log('\n😞 No formats worked. There might be an API issue or all our formats are incorrect.');
  }

  // Additional insights
  console.log('\n🔍 ANALYSIS:');
  console.log('===========');
  
  if (results.modernTool && results.legacyFunction) {
    console.log('• Both modern and legacy formats work - OpenAI is backward compatible');
  } else if (results.modernTool && !results.legacyFunction) {
    console.log('• Only modern tool format works - legacy function calling deprecated');
  } else if (!results.modernTool && results.legacyFunction) {
    console.log('• Only legacy function format works - may need to update our implementation');
  }
  
  if (!results.missingId && !results.wrongId) {
    console.log('• tool_call_id matching is strictly enforced');
  }
  
  if (!results.assistantRole && !results.userRole) {
    console.log('• Role enforcement is strict - only "tool" or "function" roles work');
  }
}

runOpenAIFormatTests().catch(console.error);