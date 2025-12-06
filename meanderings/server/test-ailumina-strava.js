#!/usr/bin/env node

/**
 * Test script to connect to AIlumina WebSocket and call Strava tools
 * This will help us confirm the fix for MCP content processing
 */

import WebSocket from 'ws';

async function testAIluminaStrava() {
  console.log('🧪 Testing AIlumina Strava integration via WebSocket...\n');
  
  const ws = new WebSocket('ws://localhost:8000/ws/ailumina');
  
  let messageId = 1;
  
  const sendMessage = (content) => {
    const message = {
      id: messageId++,
      type: 'user_message',
      content: content,
      timestamp: new Date().toISOString()
    };
    console.log('📤 Sending:', content);
    ws.send(JSON.stringify(message));
  };

  ws.on('open', () => {
    console.log('✅ Connected to AIlumina WebSocket\n');
    
    // Request Strava activity listing
    sendMessage('Use the strava_list_activities tool to get my recent activities with per_page=3');
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Received message type:', message.type);
      
      if (message.type === 'assistant_message') {
        console.log('🤖 AIlumina Response:');
        console.log('=' .repeat(80));
        console.log(message.content);
        console.log('=' .repeat(80));
        
        // Check if we got detailed activity data or just summary
        if (message.content.includes('Found') && message.content.includes('activities') && 
            !message.content.includes('"name"') && !message.content.includes('"distance"')) {
          console.log('❌ ISSUE: Got summary data only, not detailed JSON');
        } else if (message.content.includes('"name"') || message.content.includes('"distance"')) {
          console.log('✅ SUCCESS: Got detailed activity data!');
        }
        
        // Close after getting response
        setTimeout(() => {
          ws.close();
          process.exit(0);
        }, 1000);
      }
      
      if (message.type === 'tool_use') {
        console.log('🔧 Tool Use:', message.tool_name, 'with args:', JSON.stringify(message.arguments, null, 2));
      }
      
    } catch (parseError) {
      console.log('Parse error:', parseError.message);
      console.log('Raw data:', data.toString());
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });

  // Timeout after 30 seconds
  setTimeout(() => {
    console.log('⏰ Test timeout after 30 seconds');
    ws.close();
    process.exit(1);
  }, 30000);
}

// Run the test
testAIluminaStrava().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});