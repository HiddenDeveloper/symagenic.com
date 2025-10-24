#!/usr/bin/env node

/**
 * Test script for tool execution via WebSocket
 * This tests the server-side tool execution functionality
 */

import WebSocket from 'ws';

async function testToolExecution() {
  console.log('🧪 Testing tool execution functionality...');
  
  const ws = new WebSocket('ws://localhost:8000/ws/markdown_formatter');
  
  ws.on('open', function open() {
    console.log('✅ WebSocket connection established to markdown_formatter agent');
    
    // Send a message that should trigger the get_current_datetime tool
    const testMessage = {
      user_input: "Please get the current date and time for me using your tools."
    };
    
    console.log('📤 Sending test message:', testMessage);
    ws.send(JSON.stringify(testMessage));
  });

  ws.on('message', function message(data) {
    try {
      const response = JSON.parse(data.toString());
      console.log('📨 Received response:', JSON.stringify(response, null, 2));
      
      // Check for tool call indication
      if (response.tool_call) {
        console.log('🛠️  Tool call detected:', response.tool_call);
      }
      
      // Check for final response
      if (response.done) {
        console.log('✅ Test completed successfully');
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

testToolExecution().catch(console.error);