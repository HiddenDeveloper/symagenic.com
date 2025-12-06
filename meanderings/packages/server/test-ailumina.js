#!/usr/bin/env node

/**
 * Test script for AIlumina agent with MCP tools via WebSocket
 */

import WebSocket from 'ws';

async function testAIluminaAgent() {
  console.log('🧪 Testing AIlumina agent with MCP tools...');
  
  const ws = new WebSocket('ws://localhost:8000/ws/AIlumina');
  
  ws.on('open', function open() {
    console.log('✅ WebSocket connection established to AIlumina agent');
    
    // Send a message that should trigger MCP memory tools
    const testMessage = {
      user_input: "Please use your memory tools to check your schema and current status."
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
      
      if (response.tool_status) {
        console.log(`🔧 Tool ${response.tool_name} status: ${response.tool_status}`);
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

  // Timeout after 45 seconds (memory operations can take longer)
  setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
    process.exit(1);
  }, 45000);
}

testAIluminaAgent().catch(console.error);