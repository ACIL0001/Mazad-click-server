const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const BUYER_USER_ID = 'buyer123';
const SELLER_USER_ID = 'seller456';
const CHAT_ID = 'chat789';

console.log('🧪 Testing Seller Message Display');
console.log('📋 Test Configuration:');
console.log('  - Server URL:', SERVER_URL);
console.log('  - Buyer ID:', BUYER_USER_ID);
console.log('  - Seller ID:', SELLER_USER_ID);
console.log('  - Chat ID:', CHAT_ID);
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
  sellerReceivedSocketMessage: false,
  sellerReceivedBuyerToSellerMessage: false,
  sellerReceivedMessageReceived: false,
  sellerReceivedChatMessageUpdate: false,
  sellerReceivedNewMessage: false,
  sellerReceivedNotification: false
};

// Buyer socket event handlers
buyerSocket.on('connect', () => {
  console.log('✅ Buyer connected to server');
  testResults.buyerConnected = true;
  
  // Join chat room
  buyerSocket.emit('joinChat', { chatId: CHAT_ID, userId: BUYER_USER_ID });
});

buyerSocket.on('messageSentConfirmation', (data) => {
  console.log('✅ Buyer received messageSentConfirmation:', data);
  testResults.messageSent = true;
});

// Seller socket event handlers
sellerSocket.on('connect', () => {
  console.log('✅ Seller connected to server');
  testResults.sellerConnected = true;
  
  // Join chat room
  sellerSocket.emit('joinChat', { chatId: CHAT_ID, userId: SELLER_USER_ID });
});

sellerSocket.on('sendMessage', (message) => {
  console.log('✅ Seller received sendMessage event:', message);
  testResults.sellerReceivedSocketMessage = true;
});

sellerSocket.on('buyerToSellerMessage', (message) => {
  console.log('✅ Seller received buyerToSellerMessage event:', message);
  testResults.sellerReceivedBuyerToSellerMessage = true;
});

sellerSocket.on('messageReceived', (data) => {
  console.log('✅ Seller received messageReceived event:', data);
  testResults.sellerReceivedMessageReceived = true;
});

sellerSocket.on('newMessage', (data) => {
  console.log('✅ Seller received newMessage event:', data);
  testResults.sellerReceivedNewMessage = true;
});

sellerSocket.on('chatMessageUpdate', (data) => {
  console.log('✅ Seller received chatMessageUpdate event:', data);
  testResults.sellerReceivedChatMessageUpdate = true;
});

sellerSocket.on('notification', (notification) => {
  console.log('✅ Seller received notification:', notification);
  testResults.sellerReceivedNotification = true;
});

// Test function to send message
function sendTestMessage() {
  console.log('📤 Sending test message from buyer to seller...');
  
  const testMessage = {
    sender: BUYER_USER_ID,
    reciver: SELLER_USER_ID,
    message: 'Hello Seller! This is a test message to verify display!',
    idChat: CHAT_ID
  };
  
  // Send message via socket
  buyerSocket.emit('sendMessage', testMessage);
  
  // Also send via HTTP API for database storage
  sendMessageViaAPI(testMessage);
}

// Send message via HTTP API
async function sendMessageViaAPI(messageData) {
  try {
    const response = await fetch(`${SERVER_URL}/message/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-key': '8f2a61c94d7e3b5f9c0a8d2e6b4f1c7a'
      },
      body: JSON.stringify(messageData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Message saved to database:', result);
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
  console.log('✅ Seller Received sendMessage:', testResults.sellerReceivedSocketMessage ? 'PASS' : 'FAIL');
  console.log('✅ Seller Received buyerToSellerMessage:', testResults.sellerReceivedBuyerToSellerMessage ? 'PASS' : 'FAIL');
  console.log('✅ Seller Received messageReceived:', testResults.sellerReceivedMessageReceived ? 'PASS' : 'FAIL');
  console.log('✅ Seller Received newMessage:', testResults.sellerReceivedNewMessage ? 'PASS' : 'FAIL');
  console.log('✅ Seller Received chatMessageUpdate:', testResults.sellerReceivedChatMessageUpdate ? 'PASS' : 'FAIL');
  console.log('✅ Seller Received notification:', testResults.sellerReceivedNotification ? 'PASS' : 'FAIL');
  
  const socketEventsReceived = [
    testResults.sellerReceivedSocketMessage,
    testResults.sellerReceivedBuyerToSellerMessage,
    testResults.sellerReceivedMessageReceived,
    testResults.sellerReceivedNewMessage,
    testResults.sellerReceivedChatMessageUpdate
  ].filter(Boolean).length;
  
  console.log('\n📡 Socket Events Received by Seller:', socketEventsReceived, 'out of 5');
  
  const allPassed = testResults.buyerConnected && 
                   testResults.sellerConnected && 
                   testResults.messageSent && 
                   socketEventsReceived > 0;
  
  console.log('\n🎯 Overall Result:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  
  if (allPassed) {
    console.log('🎉 Seller should now display socket messages in chat!');
    console.log('💡 Check the seller dashboard to see if messages appear in real-time.');
  } else {
    console.log('⚠️ Some issues detected. Check the logs above.');
  }
}

// Run the test
setTimeout(() => {
  if (testResults.buyerConnected && testResults.sellerConnected) {
    console.log('\n🚀 Starting message display test...');
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

console.log('⏳ Waiting for connections...');
