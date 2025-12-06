#!/usr/bin/env node

/**
 * Debug script to test different OLLAMA URL configurations
 * and see which ones work vs hang/fail
 */

import { OllamaProvider } from './src/shared/services/ollama-provider.js';

const testConfigs = [
  {
    name: 'Current Default',
    baseUrl: 'http://localhost:11434/v1',
    description: 'Current implementation with /v1'
  },
  {
    name: 'No /v1',
    baseUrl: 'http://localhost:11434',
    description: 'Base URL without /v1'
  },
  {
    name: 'Native API',
    baseUrl: 'http://localhost:11434/api',
    description: 'OLLAMA native API base'
  },
  {
    name: 'Double /v1',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    description: 'Wrong - would create double path'
  }
];

async function testUrlConfig(config) {
  console.log(`\n🧪 Testing: ${config.name}`);
  console.log(`   URL: ${config.baseUrl}`);
  console.log(`   Description: ${config.description}`);
  
  try {
    // Set environment variable
    process.env.OLLAMA_BASE_URL = config.baseUrl;
    
    const testAgentConfig = {
      service_provider: 'OLLAMA',
      model_name: 'gpt-oss:latest',
      system_prompt: 'You are a helpful assistant.',
      do_stream: false,
      available_functions: []
    };

    const provider = new OllamaProvider(
      testAgentConfig,
      'debug-test-agent',
      'debug-session'
    );

    console.log('   ✅ Provider created successfully');
    
    // Test simple API call with timeout
    const startTime = Date.now();
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000);
    });
    
    const apiCallPromise = provider.makeApiCall(
      [],
      'Say hello',
      null,
      false
    );
    
    const result = await Promise.race([apiCallPromise, timeoutPromise]);
    const elapsed = Date.now() - startTime;
    
    console.log(`   ✅ API call successful (${elapsed}ms)`);
    console.log(`   Response: ${result.response.content?.substring(0, 50)}...`);
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    
    if (error.message.includes('Timeout')) {
      console.log(`   ⚠️  This configuration causes hanging!`);
    } else if (error.message.includes('404') || error.message.includes('not found')) {
      console.log(`   ⚠️  Endpoint not found - wrong URL construction`);
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log(`   ⚠️  OLLAMA not running or wrong port`);
    }
  }
  
  // Clean up environment
  delete process.env.OLLAMA_BASE_URL;
}

async function runAllTests() {
  console.log('🔍 OLLAMA URL Configuration Debug Test');
  console.log('=====================================');
  
  for (const config of testConfigs) {
    await testUrlConfig(config);
  }
  
  console.log('\n✅ All tests completed');
  console.log('\nLook for:');
  console.log('- ✅ Working configurations');
  console.log('- ❌ Failing configurations');
  console.log('- ⚠️  Hanging configurations (timeout errors)');
}

runAllTests().catch(console.error);