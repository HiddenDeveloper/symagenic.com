#!/usr/bin/env node

/**
 * Simple test script for Google provider with one tool call only
 */

import WebSocket from 'ws';

async function testGoogleProviderSimple() {
  console.log('🧪 Testing Google provider tool execution (simple)...');
  
  const ws = new WebSocket('ws://localhost:8000/ws/aaaAIlumina');
  
  ws.on('open', function open() {
    console.log('✅ WebSocket connection established to aaaAIlumina agent (Google)');
    
    // Send a simple message that should trigger only the datetime tool
    const testMessage = {
      user_input: "What time is it right now? Just get the current time and tell me.",
      service_provider: "GOOGLE"
    };
    
    console.log('📤 Sending test message:', testMessage);
    ws.send(JSON.stringify(testMessage));
  });

  ws.on('message', function message(data) {
    try {
      const response = JSON.parse(data.toString());
      console.log('📨 Received response:', JSON.stringify(response, null, 2));
      
      // Check for errors
      if (response.sentence && response.sentence.includes('Error')) {
        console.log('❌ Error detected in response');
      }
      
      // Check for tool call indication
      if (response.tool_call) {
        console.log('🛠️  Tool call detected:', response.tool_call);
      }
      
      // Check for final response
      if (response.done) {
        console.log('✅ Test completed');
        ws.close();
        process.exit(0);
      }
      
    } catch (error) {
      console.log('📨 Raw response:', data.toString());
    }
  });

  ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err);
    process.exit(1);
  });

  ws.on('close', function close() {
    console.log('🔌 WebSocket connection closed');
  });

  // Timeout after 30 seconds
  setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
    process.exit(1);
  }, 30000);
}

testGoogleProviderSimple().catch(console.error);