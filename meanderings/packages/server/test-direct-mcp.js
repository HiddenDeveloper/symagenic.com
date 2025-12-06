#!/usr/bin/env node

/**
 * Test script to directly test the MCP manager executeTool method
 * This will trigger our debug logging for Strava tools
 */

import MCPManager from './src/shared/tools/mcp-manager.js';

async function testDirectMCP() {
  console.log('🧪 Testing MCP Manager directly...\n');
  
  try {
    const mcpManager = new MCPManager();
    await mcpManager.start();
    
    console.log('✅ MCP Manager started, calling Strava tool...\n');
    
    const result = await mcpManager.executeTool(
      'strava',
      'strava_list_activities', 
      { per_page: 3 }
    );
    
    console.log('🎯 Final Result:');
    console.log('=' .repeat(80));
    console.log(result);
    console.log('=' .repeat(80));
    
    await mcpManager.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run the test
testDirectMCP();