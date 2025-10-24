#!/usr/bin/env node

// Simple WebSocket test client for LMStudio integration
import WebSocket from 'ws';

async function testLMStudioIntegration() {
  console.log('🔧 Testing LMStudio integration with journaling agent...');
  
  try {
    const ws = new WebSocket('ws://localhost:8000/ws/journaling');
    
    ws.on('open', function() {
      console.log('✅ WebSocket connected to journaling agent');
      
      // Send a test message that should trigger function calling
      const testMessage = {
        action: 'send_message',
        message: 'Hello! Could you please check what time it is right now? Use your available functions to get the current date and time.'
      };
      
      console.log('📤 Sending test message:', testMessage.message);
      ws.send(JSON.stringify(testMessage));
    });
    
    ws.on('message', function(data) {
      try {
        const message = JSON.parse(data.toString());
        console.log('📥 Received message:', message);
        
        // Look for function calling indicators
        if (message.type === 'tool_status') {
          console.log('🛠️  Tool execution detected:', message);
        } else if (message.type === 'message') {
          console.log('💬 Agent response:', message.content);
        }
        
      } catch (err) {
        console.log('📥 Raw message:', data.toString());
      }
    });
    
    ws.on('error', function(error) {
      console.error('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', function() {
      console.log('🔌 WebSocket connection closed');
      process.exit(0);
    });
    
    // Close after 30 seconds
    setTimeout(() => {
      console.log('⏱️  Test timeout - closing connection');
      ws.close();
    }, 30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLMStudioIntegration();