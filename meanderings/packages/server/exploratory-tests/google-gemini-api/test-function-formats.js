#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGeminiFunctionResponse() {
  console.log('🧪 Testing Google Gemini Function Response Format - Final Test\n');
  
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('❌ No GOOGLE_API_KEY found');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const weatherFunction = {
    name: 'get_weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'OBJECT',
      properties: {
        location: { type: 'STRING', description: 'City name' }
      },
      required: ['location']
    }
  };

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      tools: [{ functionDeclarations: [weatherFunction] }]
    });

    // Step 1: Get function call
    console.log('📤 Requesting weather function call...');
    const prompt = 'Please use the get_weather function to check the weather in Paris';
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    console.log('📥 Response received');
    console.log('Text response:', result.response.text() || '[No text]');
    
    const functionCalls = result.response.functionCalls();
    console.log('Function calls:', functionCalls || '[No function calls]');

    if (!functionCalls || functionCalls.length === 0) {
      console.log('❌ No function calls - trying more explicit prompt...');
      
      const explicitResult = await model.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ text: 'You MUST use the get_weather function. Call get_weather for Paris, France right now.' }] 
        }]
      });

      const explicitFunctionCalls = explicitResult.response.functionCalls();
      if (!explicitFunctionCalls || explicitFunctionCalls.length === 0) {
        console.log('❌ Still no function calls received');
        
        // Let's debug what we got
        console.log('Full response candidates:');
        console.log(JSON.stringify(explicitResult.response.candidates, null, 2));
        return;
      }
      
      // Use the explicit result
      console.log('✅ Got function call with explicit prompt');
      
      const functionCall = explicitFunctionCalls[0];
      console.log('Function call details:', functionCall);
      
      // Step 2: Test function response formats
      const functionResult = `Weather in ${functionCall.args.location}: Sunny, 18°C, light breeze`;
      console.log('⚡ Function result:', functionResult);
      
      // Test different ways to send the function response
      await testResponseFormat('Direct string', functionCall, functionResult, model, explicitResult);
      await testResponseFormat('Object with result field', functionCall, { result: functionResult }, model, explicitResult);
      await testResponseFormat('Object with content field', functionCall, { content: functionResult }, model, explicitResult);
      await testResponseFormat('Object with output field', functionCall, { output: functionResult }, model, explicitResult);
      
      return;
    }

    const functionCall = functionCalls[0];
    console.log('✅ Function call received:', functionCall);
    
    // Step 2: Test response formats
    const functionResult = `Weather in ${functionCall.args.location}: Sunny, 18°C, light breeze`;
    console.log('⚡ Function result:', functionResult);
    
    await testResponseFormat('Direct string', functionCall, functionResult, model, result);
    await testResponseFormat('Object with result field', functionCall, { result: functionResult }, model, result);
    await testResponseFormat('Object with content field', functionCall, { content: functionResult }, model, result);
    await testResponseFormat('Object with output field', functionCall, { output: functionResult }, model, result);
    
    // Test assistant role (based on scratchpad evidence)
    await testAssistantRoleResponse('Assistant role function response', functionCall, functionResult, model, result);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testResponseFormat(formatName, functionCall, responseValue, model, originalResult) {
  console.log(`\n🧪 Testing: ${formatName}`);
  
  try {
    // Create a fresh chat with the function response
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Please use the get_weather function to check the weather in Paris' }]
        },
        {
          role: 'model',
          parts: originalResult.response.candidates[0].content.parts
        }
      ]
    });

    // Send function response
    const functionResponsePart = {
      functionResponse: {
        name: functionCall.name,
        response: responseValue
      }
    };

    console.log('   📤 Sending response structure:');
    console.log('   ', JSON.stringify(functionResponsePart, null, 4));

    const continueResult = await chat.sendMessage([functionResponsePart]);
    
    console.log(`   ✅ ${formatName} WORKS!`);
    console.log(`   📥 AI Response: ${continueResult.response.text().substring(0, 120)}...`);
    
    return true;
    
  } catch (error) {
    console.log(`   ❌ ${formatName} FAILED: ${error.message}`);
    return false;
  }
}

async function testAssistantRoleResponse(formatName, functionCall, functionResult, model, originalResult) {
  console.log(`\n🧪 Testing: ${formatName} (scratchpad evidence)`);
  
  try {
    // Create a fresh chat with the function response using assistant role
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Please use the get_weather function to check the weather in Paris' }]
        },
        {
          role: 'model',
          parts: originalResult.response.candidates[0].content.parts
        }
      ]
    });

    // Send function response with assistant role (like scratchpad shows)
    const assistantResponseMessage = {
      role: 'model',  // Google uses 'model' role for assistant responses
      parts: [
        {
          functionResponse: {
            name: functionCall.name,
            response: { 
              content: functionResult 
            }
          }
        }
      ]
    };

    console.log('   📤 Sending assistant role response structure:');
    console.log('   ', JSON.stringify(assistantResponseMessage, null, 4));

    // Try to add this message to history and continue
    const chatWithAssistantResponse = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Please use the get_weather function to check the weather in Paris' }]
        },
        {
          role: 'model',
          parts: originalResult.response.candidates[0].content.parts
        },
        assistantResponseMessage
      ]
    });

    const continueResult = await chatWithAssistantResponse.sendMessage([{ text: 'What did you find?' }]);
    
    console.log(`   ✅ ${formatName} WORKS!`);
    console.log(`   📥 AI Response: ${continueResult.response.text().substring(0, 120)}...`);
    
    return true;
    
  } catch (error) {
    console.log(`   ❌ ${formatName} FAILED: ${error.message}`);
    return false;
  }
}

testGeminiFunctionResponse().catch(console.error);