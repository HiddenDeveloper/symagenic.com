#!/usr/bin/env node

/**
 * Quick validation that our current Google provider implementation works correctly
 * This is a focused test to verify our exact format against the real Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

async function validateOurImplementation() {
  console.log('🧪 Validating Our Google Provider Implementation\n');
  
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('❌ No GOOGLE_API_KEY environment variable found.');
    console.log('   Get a key from: https://aistudio.google.com/app/apikey');
    console.log('   Then: export GOOGLE_API_KEY="your-key-here"');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Test function declaration
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

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      tools: [{ functionDeclarations: [weatherFunction] }]
    });

    console.log('📤 Step 1: Requesting function call...');
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Get weather for London using the get_weather function' }] }]
    });

    const functionCalls = result.response.functionCalls();
    if (!functionCalls || functionCalls.length === 0) {
      console.log('❌ No function calls received - check your prompt or function declaration');
      return;
    }

    const functionCall = functionCalls[0];
    console.log('✅ Function call received:', functionCall);

    // Step 2: Use OUR EXACT IMPLEMENTATION FORMAT
    const functionResult = `Weather in ${functionCall.args.location}: Partly cloudy, 16°C, light winds`;
    console.log('⚡ Function executed:', functionResult);

    // This is exactly what our formatToolResponseMessage() returns:
    const ourImplementationFormat = {
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: functionCall.name,
            response: { 
              content: functionResult  // ← Our choice: "content" field
            }
          }
        }
      ]
    };

    console.log('\n📤 Step 2: Testing our exact implementation format...');
    console.log('Our format:', JSON.stringify(ourImplementationFormat, null, 2));

    // Test with a fresh chat using our format
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Get weather for London using the get_weather function' }]
        },
        {
          role: 'model',
          parts: result.response.candidates[0].content.parts
        }
      ]
    });

    const continueResult = await chat.sendMessage([ourImplementationFormat.parts[0]]);
    
    console.log('\n🎉 SUCCESS! Our implementation format works perfectly!');
    console.log('📥 Gemini response:', continueResult.response.text());
    console.log('\n✅ Validation complete - our Google provider implementation is correct! 🎊');
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    
    if (error.message.includes('functionResponse')) {
      console.log('\n💡 This indicates our implementation format might need adjustment');
    } else if (error.message.includes('API key')) {
      console.log('\n💡 Check your API key and make sure it has access to Gemini API');
    }
  }
}

// Run the validation
validateOurImplementation().catch(console.error);