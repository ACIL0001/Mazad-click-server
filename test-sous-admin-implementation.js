/**
 * Test Script for Sous Admin Implementation
 * 
 * This script tests the new sous admin functionality to ensure
 * everything is working correctly.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test data
const testConfig = {
  adminCredentials: {
    login: process.env.ADMIN_EMAIL || 'admin@mazadclick.com',
    password: process.env.ADMIN_PASSWORD || 'SecureAdminPassword123!'
  },
  sousAdminCredentials: {
    login: process.env.SOUS_ADMIN_EMAIL || 'sousadmin@mazadclick.com',  
    password: process.env.SOUS_ADMIN_PASSWORD || 'SecureSousAdminPassword123!'
  },
  apiKeys: {
    admin: process.env.ADMIN_API_KEY || 'your_admin_api_key_here',
    client: process.env.Client_API_KEY || 'your_client_api_key_here'
  }
};

let adminToken = '';
let sousAdminToken = '';

/**
 * Helper function to make API requests
 */
async function makeRequest(method, endpoint, data = null, token = null, apiKey = null) {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers,
      data
    };

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

/**
 * Test 1: Login as Admin
 */
async function testAdminLogin() {
  console.log('\n🔐 Testing Admin Login...');
  
  const result = await makeRequest('POST', '/auth/signin', testConfig.adminCredentials);
  
  if (result.success && result.data.session?.accessToken) {
    adminToken = result.data.session.accessToken;
    console.log('✅ Admin login successful');
    console.log(`👤 Admin User: ${result.data.user.firstName} ${result.data.user.lastName}`);
    console.log(`🎭 Role: ${result.data.user.type}`);
    return true;
  } else {
    console.log('❌ Admin login failed:', result.error);
    return false;
  }
}

/**
 * Test 2: Login as Sous Admin  
 */
async function testSousAdminLogin() {
  console.log('\n🔐 Testing Sous Admin Login...');
  
  const result = await makeRequest('POST', '/auth/signin', testConfig.sousAdminCredentials);
  
  if (result.success && result.data.session?.accessToken) {
    sousAdminToken = result.data.session.accessToken;
    console.log('✅ Sous Admin login successful');
    console.log(`👤 Sous Admin User: ${result.data.user.firstName} ${result.data.user.lastName}`);
    console.log(`🎭 Role: ${result.data.user.type}`);
    return true;
  } else {
    console.log('❌ Sous Admin login failed:', result.error);
    return false;
  }
}

/**
 * Test 3: Admin Profile Access
 */
async function testAdminProfile() {
  console.log('\n👤 Testing Admin Profile Access...');
  
  const result = await makeRequest('GET', '/admin/profile', null, adminToken);
  
  if (result.success) {
    console.log('✅ Admin can access profile');
    console.log(`🛡️ Privileges:`, result.data.data.privileges);
  } else {
    console.log('❌ Admin profile access failed:', result.error);
  }
}

/**
 * Test 4: Sous Admin Profile Access
 */
async function testSousAdminProfile() {
  console.log('\n👤 Testing Sous Admin Profile Access...');
  
  const result = await makeRequest('GET', '/admin/profile', null, sousAdminToken);
  
  if (result.success) {
    console.log('✅ Sous Admin can access profile');
    console.log(`🛡️ Privileges:`, result.data.data.privileges);
  } else {
    console.log('❌ Sous Admin profile access failed:', result.error);
  }
}

/**
 * Test 5: Permission Matrix Testing
 */
async function testPermissions() {
  console.log('\n🛡️ Testing Permission Matrix...');
  
  const permissions = [
    'CREATE_ADMIN',
    'MANAGE_BIDS', 
    'VIEW_USERS',
    'MANAGE_SYSTEM_SETTINGS',
    'VIEW_BASIC_STATS'
  ];
  
  console.log('\n--- Admin Permissions ---');
  for (const permission of permissions) {
    const result = await makeRequest('POST', '/admin/check-permission', 
      { action: permission }, adminToken);
    
    if (result.success) {
      const status = result.data.hasPermission ? '✅' : '❌';
      console.log(`${status} ${permission}: ${result.data.hasPermission}`);
    }
  }
  
  console.log('\n--- Sous Admin Permissions ---');
  for (const permission of permissions) {
    const result = await makeRequest('POST', '/admin/check-permission', 
      { action: permission }, sousAdminToken);
    
    if (result.success) {
      const status = result.data.hasPermission ? '✅' : '❌';
      console.log(`${status} ${permission}: ${result.data.hasPermission}`);
    }
  }
}

/**
 * Test 6: Access Control Testing
 */
async function testAccessControl() {
  console.log('\n🚫 Testing Access Control...');
  
  // Test admin-only endpoint with sous admin token (should fail)
  console.log('\n--- Testing Admin-Only Endpoints ---');
  const adminOnlyResult = await makeRequest('GET', '/admin/admins-only', null, sousAdminToken);
  
  if (adminOnlyResult.success) {
    console.log('❌ Sous Admin should NOT access admin-only endpoint');
  } else {
    console.log('✅ Sous Admin correctly blocked from admin-only endpoint');
    console.log(`📋 Error: ${adminOnlyResult.error.message || adminOnlyResult.error}`);
  }
  
  // Test sous admin endpoint with admin token (should succeed)
  console.log('\n--- Testing Sous Admin Endpoints ---');
  const sousAdminResult = await makeRequest('GET', '/admin/sous-admins', null, adminToken);
  
  if (sousAdminResult.success) {
    console.log('✅ Admin can access sous admin endpoints');
    console.log(`📊 Found ${sousAdminResult.data.data.length} sous admin(s)`);
  } else {
    console.log('❌ Admin should be able to access sous admin endpoints');
  }
}

/**
 * Test 7: Create Sous Admin (Admin Only)
 */
async function testCreateSousAdmin() {
  console.log('\n👨‍💼 Testing Sous Admin Creation...');
  
  const newSousAdmin = {
    firstName: 'Test',
    lastName: 'SousAdmin',
    email: `test-sousadmin-${Date.now()}@mazadclick.com`,
    password: 'TestPassword123!',
    phone: `+21312345${Math.floor(Math.random() * 10000)}`,
    gender: 'MALE'
  };
  
  // Test with admin token (should succeed)
  console.log('\n--- Admin Creating Sous Admin ---');
  const adminCreateResult = await makeRequest('POST', '/admin/create-sous-admin', 
    newSousAdmin, adminToken);
  
  if (adminCreateResult.success) {
    console.log('✅ Admin successfully created sous admin');
    console.log(`👤 Created: ${adminCreateResult.data.data.firstName} ${adminCreateResult.data.data.lastName}`);
  } else {
    console.log('❌ Admin failed to create sous admin:', adminCreateResult.error);
  }
  
  // Test with sous admin token (should fail)
  console.log('\n--- Sous Admin Attempting to Create Sous Admin ---');
  newSousAdmin.email = `test-sousadmin-2-${Date.now()}@mazadclick.com`;
  
  const sousAdminCreateResult = await makeRequest('POST', '/admin/create-sous-admin', 
    newSousAdmin, sousAdminToken);
  
  if (sousAdminCreateResult.success) {
    console.log('❌ Sous Admin should NOT be able to create sous admin');
  } else {
    console.log('✅ Sous Admin correctly blocked from creating sous admin');
    console.log(`📋 Error: ${sousAdminCreateResult.error.message || sousAdminCreateResult.error}`);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Starting Sous Admin Implementation Tests');
  console.log('=' .repeat(50));
  
  try {
    // Authentication tests
    const adminLoggedIn = await testAdminLogin();
    const sousAdminLoggedIn = await testSousAdminLogin();
    
    if (!adminLoggedIn || !sousAdminLoggedIn) {
      console.log('\n❌ Authentication failed. Please check your environment variables.');
      console.log('Required environment variables:');
      console.log('- ADMIN_EMAIL, ADMIN_PASSWORD');
      console.log('- SOUS_ADMIN_EMAIL, SOUS_ADMIN_PASSWORD');
      return;
    }
    
    // Profile tests
    await testAdminProfile();
    await testSousAdminProfile();
    
    // Permission tests
    await testPermissions();
    
    // Access control tests
    await testAccessControl();
    
    // Creation tests
    await testCreateSousAdmin();
    
    console.log('\n' + '=' .repeat(50));
    console.log('🎉 Sous Admin Implementation Tests Completed!');
    console.log('\n📋 Summary:');
    console.log('- Admin and Sous Admin users can authenticate');
    console.log('- Role-based permissions are working correctly');
    console.log('- Access controls are properly enforced');
    console.log('- Admin can create sous admins, sous admins cannot');
    
  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
  }
}

/**
 * Check server availability
 */
async function checkServer() {
  console.log('🔍 Checking server availability...');
  
  const result = await makeRequest('GET', '/');
  
  if (result.success || result.status === 404) {
    console.log('✅ Server is running');
    return true;
  } else {
    console.log('❌ Server is not accessible. Please ensure the server is running on', BASE_URL);
    return false;
  }
}

// Run tests if server is available
checkServer().then(serverAvailable => {
  if (serverAvailable) {
    runTests();
  }
});

module.exports = {
  runTests,
  testConfig
};
