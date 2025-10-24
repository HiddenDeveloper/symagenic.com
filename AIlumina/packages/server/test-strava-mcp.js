#!/usr/bin/env node

/**
 * Test script to directly call Strava MCP server at localhost:4001/mcp
 * This will help us understand the exact response format being returned
 */

const MCP_URL = 'http://localhost:4001/mcp';

async function testStravaMCP() {
  console.log('🧪 Testing Strava MCP Server directly...\n');
  
  // Use EventSource for persistent connection to maintain session
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(MCP_URL, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    let messageId = 1;
    let initialized = false;

    eventSource.onopen = () => {
      console.log('🔗 EventSource connection opened');
      
      // Send initialization message
      console.log('Step 1: Initialize MCP session');
      fetch(MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: messageId++,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          }
        })
      }).catch(err => console.log('Init send error:', err));
    };

    eventSource.onmessage = async (event) => {
      console.log('📨 Received message:', event.data);
      
      try {
        const data = JSON.parse(event.data);
        
        if (!initialized && data.result?.serverInfo) {
          console.log('✅ Initialized successfully');
          console.log('Server info:', JSON.stringify(data.result.serverInfo, null, 2));
          initialized = true;
          
          // Now call list activities
          console.log('\nStep 2: Call strava_list_activities with per_page=3');
          const activitiesResponse = await fetch(MCP_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: messageId++,
              method: 'tools/call',
              params: {
                name: 'strava_list_activities',
                arguments: {
                  per_page: 3
                }
              }
            })
          });
          
          console.log('Activities HTTP response status:', activitiesResponse.status);
          
        } else if (data.result?.content) {
          console.log('🎯 RAW ACTIVITIES RESPONSE:');
          console.log('=' .repeat(80));
          console.log(event.data);
          console.log('=' .repeat(80));
          
          console.log('\n📊 PARSED ACTIVITIES DATA:');
          console.log(JSON.stringify(data, null, 2));
          
          console.log('\n🔍 CONTENT FIELD:');
          console.log(JSON.stringify(data.result.content, null, 2));
          
          eventSource.close();
          resolve();
          
        } else if (data.error) {
          console.log('❌ Error response:', JSON.stringify(data.error, null, 2));
          eventSource.close();
          reject(new Error(data.error.message));
        }
      } catch (parseError) {
        console.log('Parse error:', parseError.message);
      }
    };

    eventSource.onerror = (error) => {
      console.log('EventSource error:', error);
      eventSource.close();
      reject(error);
    };

    // Timeout after 30 seconds
    setTimeout(() => {
      eventSource.close();
      reject(new Error('Test timeout after 30 seconds'));
    }, 30000);
  });
}

    console.log('Activities response status:', activitiesResponse.status);
    const activitiesText = await activitiesResponse.text();
    console.log('🎯 RAW ACTIVITIES RESPONSE:');
    console.log('=' .repeat(80));
    console.log(activitiesText);
    console.log('=' .repeat(80));

    // Try to parse the response
    let activitiesData;
    if (activitiesText.startsWith('event: message\ndata: ')) {
      const jsonStr = activitiesText.split('data: ')[1].trim();
      activitiesData = JSON.parse(jsonStr);
    } else {
      activitiesData = JSON.parse(activitiesText);
    }

    console.log('\n📊 PARSED ACTIVITIES DATA:');
    console.log(JSON.stringify(activitiesData, null, 2));

    if (activitiesData.result?.content) {
      console.log('\n🔍 CONTENT FIELD:');
      console.log(JSON.stringify(activitiesData.result.content, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testStravaMCP().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});