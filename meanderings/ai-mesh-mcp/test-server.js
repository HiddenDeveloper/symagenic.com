// Simple test script for the AI Mesh MCP Server
import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testServer() {
  console.log('🧪 Testing AI Mesh MCP Server...\n');

  try {
    // Test 1: Server info
    console.log('1. Testing server info...');
    const infoResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ Server info:', infoResponse.data.name);
    console.log(`   Session ID: ${infoResponse.data.mesh.sessionId}`);
    console.log(`   Connected: ${infoResponse.data.mesh.connected}\n`);

    // Test 2: Health check
    console.log('2. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health status:', healthResponse.data.status);
    console.log(`   Redis connected: ${healthResponse.data.mesh.connected}\n`);

    // Test 3: List tools
    console.log('3. Testing tools list...');
    const toolsResponse = await axios.get(`${BASE_URL}/tools`);
    console.log('✅ Available tools:', toolsResponse.data.tools.map(t => t.name).join(', '));
    console.log(`   Total tools: ${toolsResponse.data.tools.length}\n`);

    // Test 4: Execute mesh-status tool
    console.log('4. Testing mesh-status tool...');
    const statusResponse = await axios.post(`${BASE_URL}/tools/mesh-status/call`, {});
    console.log('✅ Mesh status executed successfully');
    console.log(`   Result: ${JSON.stringify(statusResponse.data.result, null, 2)}\n`);

    // Test 5: Test mesh-broadcast tool
    console.log('5. Testing mesh-broadcast tool...');
    const broadcastResponse = await axios.post(`${BASE_URL}/tools/mesh-broadcast/call`, {
      content: "Hello from test script!",
      priority: "medium",
      participantName: "TestScript"
    });
    console.log('✅ Mesh broadcast executed successfully');
    console.log(`   Message ID: ${broadcastResponse.data.result.messageId}\n`);

    // Test 6: Get mesh info resource
    console.log('6. Testing mesh info resource...');
    const meshInfoResponse = await axios.get(`${BASE_URL}/resources/mesh/info`);
    console.log('✅ Mesh info retrieved successfully');
    console.log(`   Mesh health: ${meshInfoResponse.data.topology.meshHealth}\n`);

    console.log('🎉 All tests passed! AI Mesh MCP Server is working correctly.');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to server. Make sure the server is running with:');
      console.error('   npm run dev:both');
    } else {
      console.error('❌ Test failed:', error.response?.data || error.message);
    }
    process.exit(1);
  }
}

testServer();