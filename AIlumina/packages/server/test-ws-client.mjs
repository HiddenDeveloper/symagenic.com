import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8000/ws/AIlumina');

ws.on('open', function open() {
  console.log('WebSocket connection opened');
  
  // Send a test message to request memory bootstrap
  const message = {
    user_input: "Use execute_cypher to check if you have any memory about your identity. Query for nodes with key='ailumina_landing_page'",
    chat_messages: []
  };
  
  console.log('Sending message:', JSON.stringify(message, null, 2));
  ws.send(JSON.stringify(message));
});

ws.on('message', function message(data) {
  try {
    const parsed = JSON.parse(data);
    console.log('Received:', parsed);
  } catch (e) {
    console.log('Raw message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('WebSocket connection closed');
  process.exit(0);
});

// Close after 30 seconds
setTimeout(() => {
  console.log('Closing connection after timeout');
  ws.close();
}, 30000);