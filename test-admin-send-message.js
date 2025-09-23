const axios = require('axios');

// Test admin sending message
async function testAdminSendMessage() {
  console.log('🧪 Testing admin sending message...');
  
  try {
    // Simulate admin sending message to a user
    const messageData = {
      idChat: 'test-chat-id',
      message: 'This is a test message from admin',
      sender: 'admin',
      reciver: 'test-user-123', // This should be the user ID, not admin ID
    };
    
    console.log('📤 Sending message data:', messageData);
    
    // Make API call to send message
    const response = await axios.post('http://localhost:3000/message/create', messageData, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('✅ Message sent successfully:', response.data);
    console.log('✅ Receiver was correctly set to user ID:', response.data.reciver);
    
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
  }
}

// Run the test
testAdminSendMessage().catch(console.error);
