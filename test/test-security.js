const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Assuming default port
const EMAIL = `test-security-${Date.now()}@example.com`;
const PHONE = `0555${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

async function testRateLimiting() {
  console.log('\n--- Testing Rate Limiting (SignIn) ---');
  let successCount = 0;
  let blockedCount = 0;

  // Try 10 rapid login attempts
  for (let i = 0; i < 10; i++) {
    try {
      await axios.post(`${BASE_URL}/auth/signin`, {
        login: 'test@example.com',
        password: 'wrongpassword'
      });
      process.stdout.write('.');
      successCount++;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        process.stdout.write('X');
        blockedCount++;
      } else {
        process.stdout.write('E'); // Check status code if not 429
        // console.log(error.response ? error.response.status : error.message);
      }
    }
  }
  console.log(`\nResults: ${successCount} processed, ${blockedCount} rate limited`);
  
  if (blockedCount > 0) {
      console.log('✅ Rate limiting is working!');
  } else {
      console.log('❌ Rate limiting NOT working (or limit too high)');
  }
}

async function testEmailUniqueness() {
  console.log('\n--- Testing Email Uniqueness Race Condition ---');
  
  const userData = {
    firstName: 'Test',
    lastName: 'Security',
    email: EMAIL,
    phone: PHONE,
    password: 'Password123!',
    type: 'CLIENT'
  };

  console.log(`Trying to register ${EMAIL} twice concurrently...`);

  const req1 = axios.post(`${BASE_URL}/auth/signup`, userData);
  const req2 = axios.post(`${BASE_URL}/auth/signup`, { ...userData, phone: '0555999999' }); // Different phone to isolate email check

  try {
    const results = await Promise.allSettled([req1, req2]);
    
    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    
    console.log(`Succeeded: ${succeeded.length}, Failed: ${failed.length}`);

    if (succeeded.length === 1 && failed.length === 1) {
       console.log('✅ Race condition handled! One request succeeded, one failed.');
       if (failed[0].reason.response) {
           console.log(`Failed request status: ${failed[0].reason.response.status}`);
           console.log(`Failed request data:`, failed[0].reason.response.data);
       }
    } else if (succeeded.length === 2) {
       console.log('❌ Race condition FAILED! Both requests succeeded (Duplicate emails created).');
    } else {
       console.log('⚠️ Unexpected result:', results.map(r => r.status));
    }

  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

async function runTests() {
  try {
    // Wait for server to be ready? We assume it's running.
    await testRateLimiting();
    // await testEmailUniqueness(); // Can only run this if server is running and connected to DB
  } catch (err) {
    console.error(err);
  }
}

runTests();
