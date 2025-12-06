// Test content encoding issue
const content = 'Error reading document: The "path" argument must be of type string. Received undefined';

const toolMessage = {
  role: 'tool',
  tool_call_id: '845066304',
  name: 'read_document',
  content: content
};

console.log('Tool message:');
console.log(JSON.stringify(toolMessage, null, 2));

console.log('\nStringified again:');
console.log(JSON.stringify(JSON.stringify(toolMessage)));