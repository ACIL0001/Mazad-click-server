const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const BUYER_USER_ID = 'buyer123';
const SELLER_USER_ID = 'seller456';
const CHAT_ID = 'chat789';

// Test data
const testMessage = {
  sender: BUYER_USER_ID,
  reciver: SELLER_USER_ID,
  message: 'Hello Seller! I am interested in your product!',
  idChat: CHAT_ID
};

console.log('🧪 Starting Buyer-Seller Messaging Test');
console.log('📋 Test Configuration:');
console.log('  - Server URL:', SERVER_URL);
console.log('  - Buyer ID:', BUYER_USER_ID);
console.log('  - Seller ID:', SELLER_USER_ID);
console.log('  - Chat ID:', CHAT_ID);
console.log('  - Message:', testMessage.message);
console.log('');

// Create buyer socket connection
const buyerSocket = io(SERVER_URL, {
  query: {
    userId: BUYER_USER_ID
  }
});

// Create seller socket connection
const sellerSocket = io(SERVER_URL, {
  query: {
    userId: SELLER_USER_ID
  }
});

let testResults = {
  buyerConnected: false,
  sellerConnected: false,
  messageSent: false,
  messageReceivedBySeller: false,
  notificationReceived: false,
  databaseSaved: false,
  socketEventsReceived: {
    buyer: [],
    seller: []
  }
};

// Buyer socket event handlers
buyerSocket.on('connect', () => {
  console.log('✅ Buyer connected to server');
  testResults.buyerConnected = true;
  
  // Join chat room
  buyerSocket.emit('joinChat', { chatId: CHAT_ID, userId: BUYER_USER_ID });
});

buyerSocket.on('chatJoined', (data) => {
  console.log('✅ Buyer joined chat room:', data);
});

buyerSocket.on('sendMessage', (data) => {
  console.log('✅ Buyer received sendMessage event:', data);
  testResults.socketEventsReceived.buyer.push('sendMessage');
});

buyerSocket.on('buyerMessageSent', (data) => {
  console.log('✅ Buyer received buyerMessageSent event:', data);
  testResults.socketEventsReceived.buyer.push('buyerMessageSent');
});

buyerSocket.on('messageSentConfirmation', (data) => {
  console.log('✅ Buyer received messageSentConfirmation:', data);
  testResults.messageSent = true;
});

buyerSocket.on('notification', (notification) => {
  console.log('✅ Buyer received notification:', notification);
  testResults.notificationReceived = true;
});

// Seller socket event handlers
sellerSocket.on('connect', () => {
  console.log('✅ Seller connected to server');
  testResults.sellerConnected = true;
  
  // Join chat room
  sellerSocket.emit('joinChat', { chatId: CHAT_ID, userId: SELLER_USER_ID });
});

sellerSocket.on('chatJoined', (data) => {
  console.log('✅ Seller joined chat room:', data);
});

sellerSocket.on('sendMessage', (message) => {
  console.log('✅ Seller received sendMessage event:', message);
  testResults.socketEventsReceived.seller.push('sendMessage');
  testResults.messageReceivedBySeller = true;
});

sellerSocket.on('buyerToSellerMessage', (message) => {
  console.log('✅ Seller received buyerToSellerMessage event:', message);
  testResults.socketEventsReceived.seller.push('buyerToSellerMessage');
});

sellerSocket.on('messageReceived', (data) => {
  console.log('✅ Seller received messageReceived event:', data);
  testResults.socketEventsReceived.seller.push('messageReceived');
});

sellerSocket.on('newMessage', (data) => {
  console.log('✅ Seller received newMessage event:', data);
  testResults.socketEventsReceived.seller.push('newMessage');
});

sellerSocket.on('chatMessageUpdate', (data) => {
  console.log('✅ Seller received chatMessageUpdate event:', data);
  testResults.socketEventsReceived.seller.push('chatMessageUpdate');
});

sellerSocket.on('notification', (notification) => {
  console.log('✅ Seller received notification:', notification);
  testResults.notificationReceived = true;
});

// Test function to send message
function sendTestMessage() {
  console.log('📤 Sending test message from buyer to seller...');
  
  // Send message via socket
  buyerSocket.emit('sendMessage', testMessage);
  
  // Also send via HTTP API for database storage
  sendMessageViaAPI();
}

// Send message via HTTP API
async function sendMessageViaAPI() {
  try {
    const response = await fetch(`${SERVER_URL}/message/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-key': '8f2a61c94d7e3b5f9c0a8d2e6b4f1c7a'
      },
      body: JSON.stringify(testMessage)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Message saved to database:', result);
      testResults.databaseSaved = true;
    } else {
      console.error('❌ Failed to save message to database:', response.status);
    }
  } catch (error) {
    console.error('❌ Error sending message via API:', error);
  }
}

// Test function to check results
function checkTestResults() {
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log('✅ Buyer Connected:', testResults.buyerConnected ? 'PASS' : 'FAIL');
  console.log('✅ Seller Connected:', testResults.sellerConnected ? 'PASS' : 'FAIL');
  console.log('✅ Message Sent:', testResults.messageSent ? 'PASS' : 'FAIL');
  console.log('✅ Message Received by Seller:', testResults.messageReceivedBySeller ? 'PASS' : 'FAIL');
  console.log('✅ Notification Received:', testResults.notificationReceived ? 'PASS' : 'FAIL');
  console.log('✅ Database Saved:', testResults.databaseSaved ? 'PASS' : 'FAIL');
  
  console.log('\n📡 Socket Events Received:');
  console.log('  Buyer Events:', testResults.socketEventsReceived.buyer);
  console.log('  Seller Events:', testResults.socketEventsReceived.seller);
  
  const allPassed = Object.values(testResults).every(result => {
    if (typeof result === 'object' && result !== null) {
      return true; // Skip object checks for now
    }
    return result === true;
  });
  
  console.log('\n🎯 Overall Result:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  
  if (allPassed) {
    console.log('🎉 Buyer-Seller messaging system is working correctly!');
  } else {
    console.log('⚠️ Some issues detected. Check the logs above.');
  }
}

// Run the test
setTimeout(() => {
  if (testResults.buyerConnected && testResults.sellerConnected) {
    console.log('\n🚀 Starting message test...');
    sendTestMessage();
    
    // Check results after a delay
    setTimeout(() => {
      checkTestResults();
      process.exit(0);
    }, 5000);
  } else {
    console.log('❌ Failed to establish connections');
    process.exit(1);
  }
}, 3000);

// Handle errors
buyerSocket.on('error', (error) => {
  console.error('❌ Buyer socket error:', error);
});

sellerSocket.on('error', (error) => {
  console.error('❌ Seller socket error:', error);
});

// Handle disconnections
buyerSocket.on('disconnect', () => {
  console.log('📱 Buyer disconnected');
});

sellerSocket.on('disconnect', () => {
  console.log('📱 Seller disconnected');
});

console.log('⏳ Waiting for connections...');
