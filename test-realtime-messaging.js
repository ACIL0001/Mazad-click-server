const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-123';
const TEST_ADMIN_ID = 'admin-user-456';
const TEST_CHAT_ID = 'test-chat-789';

console.log('🚀 Starting Real-time Messaging Test');
console.log('=====================================');

// Test 1: User Connection
console.log('\n📱 Test 1: User Connection');
const userSocket = io(SERVER_URL, {
  query: { userId: TEST_USER_ID }
});

userSocket.on('connect', () => {
  console.log('✅ User connected:', userSocket.id);
});

userSocket.on('disconnect', () => {
  console.log('❌ User disconnected');
});

// Test 2: Admin Connection
console.log('\n👨‍💼 Test 2: Admin Connection');
const adminSocket = io(SERVER_URL, {
  query: { userId: TEST_ADMIN_ID }
});

adminSocket.on('connect', () => {
  console.log('✅ Admin connected:', adminSocket.id);
});

adminSocket.on('disconnect', () => {
  console.log('❌ Admin disconnected');
});

// Test 3: Join Chat Room
console.log('\n💬 Test 3: Join Chat Room');
userSocket.emit('joinChat', { chatId: TEST_CHAT_ID, userId: TEST_USER_ID });
adminSocket.emit('joinChat', { chatId: TEST_CHAT_ID, userId: TEST_ADMIN_ID });

// Test 4: Listen for Messages
console.log('\n👂 Test 4: Listening for Messages');

userSocket.on('sendMessage', (data) => {
  console.log('📨 User received message:', data);
});

userSocket.on('newMessage', (data) => {
  console.log('📬 User received newMessage notification:', data);
});

userSocket.on('messageReceived', (data) => {
  console.log('📥 User received messageReceived event:', data);
});

userSocket.on('notification', (data) => {
  console.log('🔔 User received notification:', data);
});

adminSocket.on('sendMessage', (data) => {
  console.log('📨 Admin received message:', data);
});

adminSocket.on('newMessage', (data) => {
  console.log('📬 Admin received newMessage notification:', data);
});

adminSocket.on('messageReceived', (data) => {
  console.log('📥 Admin received messageReceived event:', data);
});

adminSocket.on('notification', (data) => {
  console.log('🔔 Admin received notification:', data);
});

// Test 5: Typing Indicators
console.log('\n⌨️ Test 5: Typing Indicators');

userSocket.on('userTyping', (data) => {
  console.log('⌨️ User sees typing indicator:', data);
});

adminSocket.on('userTyping', (data) => {
  console.log('⌨️ Admin sees typing indicator:', data);
});

// Test 6: Message Read Status
console.log('\n👁️ Test 6: Message Read Status');

userSocket.on('messageRead', (data) => {
  console.log('👁️ User sees message read status:', data);
});

adminSocket.on('messageRead', (data) => {
  console.log('👁️ Admin sees message read status:', data);
});

// Test 7: Chat Room Events
console.log('\n🏠 Test 7: Chat Room Events');

userSocket.on('userJoinedChat', (data) => {
  console.log('👋 User sees user joined:', data);
});

userSocket.on('userLeftChat', (data) => {
  console.log('👋 User sees user left:', data);
});

adminSocket.on('userJoinedChat', (data) => {
  console.log('👋 Admin sees user joined:', data);
});

adminSocket.on('userLeftChat', (data) => {
  console.log('👋 Admin sees user left:', data);
});

// Test 8: Real-time Message Updates
console.log('\n📡 Test 8: Real-time Message Updates');

userSocket.on('realtimeMessageUpdate', (data) => {
  console.log('📡 User received real-time update:', data);
});

adminSocket.on('realtimeMessageUpdate', (data) => {
  console.log('📡 Admin received real-time update:', data);
});

// Test 9: Test Socket Communication
console.log('\n🧪 Test 9: Test Socket Communication');

setTimeout(() => {
  console.log('🧪 Sending test message...');
  userSocket.emit('test', { message: 'Hello from user!' });
  adminSocket.emit('test', { message: 'Hello from admin!' });
}, 2000);

// Test 10: Simulate Message Sending
console.log('\n📤 Test 10: Simulate Message Sending');

setTimeout(() => {
  console.log('📤 Simulating user sending message to admin...');
  
  // Simulate typing
  userSocket.emit('typing', { 
    chatId: TEST_CHAT_ID, 
    userId: TEST_USER_ID, 
    isTyping: true 
  });
  
  setTimeout(() => {
    userSocket.emit('typing', { 
      chatId: TEST_CHAT_ID, 
      userId: TEST_USER_ID, 
      isTyping: false 
    });
    
    // Simulate sending message via API
    console.log('📤 Sending message via API...');
    sendMessageViaAPI(TEST_USER_ID, 'admin', 'Hello Admin! This is a test message.', TEST_CHAT_ID);
  }, 2000);
}, 5000);

// Test 11: Simulate Admin Response
setTimeout(() => {
  console.log('📤 Simulating admin sending message to user...');
  
  // Simulate typing
  adminSocket.emit('typing', { 
    chatId: TEST_CHAT_ID, 
    userId: TEST_ADMIN_ID, 
    isTyping: true 
  });
  
  setTimeout(() => {
    adminSocket.emit('typing', { 
      chatId: TEST_CHAT_ID, 
      userId: TEST_ADMIN_ID, 
      isTyping: false 
    });
    
    // Simulate sending message via API
    console.log('📤 Sending admin message via API...');
    sendMessageViaAPI('admin', TEST_USER_ID, 'Hello User! This is a response from admin.', TEST_CHAT_ID);
  }, 2000);
}, 10000);

// Test 12: Message Read Status
setTimeout(() => {
  console.log('👁️ Simulating message read status...');
  userSocket.emit('markMessageAsRead', { 
    messageId: 'test-message-123', 
    chatId: TEST_CHAT_ID, 
    userId: TEST_USER_ID 
  });
}, 15000);

// Test 13: Leave Chat
setTimeout(() => {
  console.log('👋 Simulating leaving chat...');
  userSocket.emit('leaveChat', { chatId: TEST_CHAT_ID, userId: TEST_USER_ID });
  adminSocket.emit('leaveChat', { chatId: TEST_CHAT_ID, userId: TEST_ADMIN_ID });
}, 20000);

// Test 14: Disconnect
setTimeout(() => {
  console.log('🔌 Disconnecting sockets...');
  userSocket.disconnect();
  adminSocket.disconnect();
  console.log('✅ Test completed!');
  process.exit(0);
}, 25000);

// Helper function to send message via API
async function sendMessageViaAPI(sender, receiver, message, chatId) {
  try {
    const response = await fetch(`${SERVER_URL}/message/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        reciver: receiver,
        message,
        idChat: chatId
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Message sent via API:', result);
    } else {
      console.error('❌ Failed to send message via API:', response.status);
    }
  } catch (error) {
    console.error('❌ Error sending message via API:', error);
  }
}

// Error handling
userSocket.on('error', (error) => {
  console.error('❌ User socket error:', error);
});

adminSocket.on('error', (error) => {
  console.error('❌ Admin socket error:', error);
});

console.log('🎯 Test script started. Watch the output for real-time messaging events...');
