const io = require('socket.io-client');

// Test admin message delivery
async function testAdminMessageDelivery() {
  console.log('🧪 Starting admin message delivery test...');
  
  // Connect as a test user
  const userSocket = io('http://localhost:3000', {
    query: { userId: 'test-user-123' }
  });
  
  userSocket.on('connect', () => {
    console.log('✅ Test user connected');
    
    // Listen for admin messages
    userSocket.on('adminMessage', (data) => {
      console.log('📨 Test user received adminMessage:', data);
    });
    
    userSocket.on('sendMessage', (data) => {
      console.log('📨 Test user received sendMessage:', data);
    });
    
    userSocket.on('newMessage', (data) => {
      console.log('📨 Test user received newMessage:', data);
    });
    
    // Test admin message delivery after 2 seconds
    setTimeout(() => {
      console.log('🧪 Testing admin message delivery...');
      userSocket.emit('testAdminMessage', {
        userId: 'test-user-123',
        message: 'This is a test admin message'
      });
    }, 2000);
  });
  
  userSocket.on('testAdminMessageResponse', (data) => {
    console.log('✅ Test admin message response:', data);
  });
  
  userSocket.on('disconnect', () => {
    console.log('❌ Test user disconnected');
  });
  
  // Cleanup after 10 seconds
  setTimeout(() => {
    console.log('🧹 Cleaning up test...');
    userSocket.disconnect();
    process.exit(0);
  }, 10000);
}

// Run the test
testAdminMessageDelivery().catch(console.error);
