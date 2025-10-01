// Test script to verify payment proof upload
const axios = require('axios');

const testPaymentProofUpload = async () => {
  console.log('🧪 Testing Payment Proof Upload...\n');

  try {
    const baseUrl = 'http://localhost:3000';
    
    // Step 1: Login as a user
    console.log('1️⃣ Logging in as a user...');
    const loginResponse = await axios.post(`${baseUrl}/auth/signin`, {
      login: 'test@example.com',
      password: 'password123'
    });
    
    if (loginResponse.status !== 200) {
      throw new Error('Login failed');
    }
    
    const { accessToken } = loginResponse.data;
    console.log('✅ Login successful, access token received');
    
    // Step 2: Get user's identity
    console.log('\n2️⃣ Getting user identity...');
    const identityResponse = await axios.get(`${baseUrl}/identities/my`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (identityResponse.status !== 200) {
      throw new Error('Failed to get identity');
    }
    
    const identity = identityResponse.data;
    console.log('✅ Identity found:', identity._id);
    console.log('   - Current payment proof:', identity.paymentProof);
    
    // Step 3: Create a test file
    console.log('\n3️⃣ Creating test payment proof file...');
    const FormData = require('form-data');
    const fs = require('fs');
    
    // Create a simple test image file
    const testImagePath = './test-payment-proof.jpg';
    const testImageBuffer = Buffer.from('fake-image-data-for-testing');
    fs.writeFileSync(testImagePath, testImageBuffer);
    
    const formData = new FormData();
    formData.append('paymentProof', fs.createReadStream(testImagePath), {
      filename: 'test-payment-proof.jpg',
      contentType: 'image/jpeg'
    });
    
    // Step 4: Upload payment proof
    console.log('\n4️⃣ Uploading payment proof...');
    const uploadResponse = await axios.put(
      `${baseUrl}/identities/${identity._id}/payment-proof`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...formData.getHeaders()
        }
      }
    );
    
    if (uploadResponse.status !== 200) {
      throw new Error('Payment proof upload failed');
    }
    
    console.log('✅ Payment proof upload successful');
    console.log('   - Response:', uploadResponse.data);
    
    // Step 5: Verify payment proof was saved
    console.log('\n5️⃣ Verifying payment proof was saved...');
    const verifyResponse = await axios.get(`${baseUrl}/identities/${identity._id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (verifyResponse.status !== 200) {
      throw new Error('Failed to verify identity');
    }
    
    const updatedIdentity = verifyResponse.data;
    console.log('✅ Identity verification successful');
    console.log('   - Payment proof:', updatedIdentity.paymentProof);
    
    if (updatedIdentity.paymentProof) {
      console.log('🎉 Payment proof successfully saved to database!');
    } else {
      console.log('❌ Payment proof not found in database');
    }
    
    // Cleanup
    fs.unlinkSync(testImagePath);
    console.log('\n🧹 Test file cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('\n💡 Note: This might be an authentication issue. Make sure:');
      console.log('   - Server is running on port 3000');
      console.log('   - Test user exists in database');
      console.log('   - User has an identity record');
    }
  }
};

// Run the test
testPaymentProofUpload();
