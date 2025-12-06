#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';

async function debugGemini() {
  const apiKey = process.env.GOOGLE_API_KEY;
  console.log('API Key present:', !!apiKey);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 10) + '...' : 'none');

  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Test 1: Simple text generation (no functions)
    console.log('\n🧪 Test 1: Simple text generation');
    const simpleModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const simpleResult = await simpleModel.generateContent('Say hello in one word');
    console.log('✅ Simple text response:', simpleResult.response.text());

    // Test 2: Function declaration
    console.log('\n🧪 Test 2: Function declaration test');
    const functionDeclaration = {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'OBJECT',
        properties: {
          location: {
            type: 'STRING',
            description: 'The location to get weather for'
          }
        },
        required: ['location']
      }
    };

    console.log('Function declaration:', JSON.stringify(functionDeclaration, null, 2));

    const modelWithTools = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      tools: [{ functionDeclarations: [functionDeclaration] }]
    });

    console.log('\n📤 Sending request with explicit function calling...');
    const result = await modelWithTools.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Use the get_weather function to check the weather in Tokyo' }] }],
      tools: [{ functionDeclarations: [functionDeclaration] }]
    });

    console.log('\n📥 Full response object:');
    console.log('Response text:', result.response.text() || '[No text]');
    console.log('Function calls:', result.response.functionCalls() || '[No function calls]');
    console.log('Candidates:', result.response.candidates?.length || 0);
    
    if (result.response.candidates && result.response.candidates[0]) {
      console.log('First candidate content:', JSON.stringify(result.response.candidates[0].content, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

debugGemini().catch(console.error);