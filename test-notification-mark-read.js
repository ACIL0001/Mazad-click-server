const axios = require('axios');

// Test script to verify notification marking functionality
async function testNotificationMarkAsRead() {
  const baseURL = 'http://localhost:3000';
  
  try {
    console.log('🧪 Testing Notification Mark as Read Functionality');
    console.log('=' .repeat(60));
    
    // Test 1: Create a test notification
    console.log('\n📝 Step 1: Creating test notification...');
    const createResponse = await axios.post(`${baseURL}/notification/test/create`, {
      message: 'Test notification for mark as read functionality'
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers if needed
      }
    });
    
    if (createResponse.data.success) {
      const notificationId = createResponse.data.notification._id;
      console.log('✅ Test notification created:', {
        id: notificationId,
        title: createResponse.data.notification.title,
        read: createResponse.data.notification.read
      });
      
      // Test 2: Mark notification as read
      console.log('\n🔖 Step 2: Marking notification as read...');
      const markReadResponse = await axios.put(`${baseURL}/notification/${notificationId}/read`, {}, {
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers if needed
        }
      });
      
      console.log('✅ Notification marked as read:', {
        id: markReadResponse.data._id,
        read: markReadResponse.data.read,
        updatedAt: markReadResponse.data.updatedAt
      });
      
      // Test 3: Verify the notification is marked as read
      console.log('\n🔍 Step 3: Verifying notification status...');
      if (markReadResponse.data.read === true) {
        console.log('✅ SUCCESS: Notification is properly marked as read in database');
      } else {
        console.log('❌ FAILURE: Notification was not marked as read');
      }
      
    } else {
      console.log('❌ Failed to create test notification');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

// Run the test
testNotificationMarkAsRead();
