#!/usr/bin/env node

/**
 * Simple test using curl-like approach for Strava MCP server
 */

async function testStravaMCP() {
  console.log('🧪 Testing Strava MCP Server directly...\n');
  
  try {
    // Use a simpler approach - just make the tool call directly
    console.log('Calling strava_list_activities directly...');
    
    const response = await fetch('http://localhost:4001/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call', 
        params: {
          name: 'strava_list_activities',
          arguments: {
            per_page: 3
          }
        }
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('\n🎯 RAW RESPONSE:');
    console.log('=' .repeat(80));
    console.log(responseText);
    console.log('=' .repeat(80));

    // Try to parse JSON if possible
    try {
      const jsonData = JSON.parse(responseText);
      console.log('\n📊 PARSED JSON:');
      console.log(JSON.stringify(jsonData, null, 2));
      
      if (jsonData.result?.content) {
        console.log('\n🔍 CONTENT ARRAY:');
        jsonData.result.content.forEach((item, index) => {
          console.log(`Item ${index}:`, JSON.stringify(item, null, 2));
        });
      }
    } catch (parseError) {
      console.log('\n⚠️  Could not parse as JSON:', parseError.message);
      
      // Check if it's server-sent events format
      if (responseText.includes('event: message')) {
        console.log('🔄 Attempting to parse as Server-Sent Events...');
        const lines = responseText.split('\n');
        const dataLine = lines.find(line => line.startsWith('data: '));
        if (dataLine) {
          try {
            const jsonData = JSON.parse(dataLine.substring(6));
            console.log('\n📊 PARSED SSE DATA:');
            console.log(JSON.stringify(jsonData, null, 2));
          } catch (sseError) {
            console.log('❌ Could not parse SSE data:', sseError.message);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
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