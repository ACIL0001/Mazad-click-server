/**
 * Test script for SATIM Payment 403 Forbidden Error Fix
 * 
 * This script tests the various components of the fix to ensure they work correctly.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_PAYMENT_DATA = {
  userId: 'test-user-id',
  subscriptionPlan: '6mois',
  amount: 8000,
  userInfo: {
    firstName: 'Test',
    lastName: 'User',
    phone: '+213123456789',
    email: 'test@example.com'
  },
  returnUrl: 'http://localhost:3003/subscription/payment/success',
  paymentMethod: 'cib'
};

async function testSatimPaymentCreation() {
  console.log('🧪 Testing SATIM Payment Creation...');
  
  try {
    const response = await axios.post(`${BASE_URL}/subscription/payment`, TEST_PAYMENT_DATA, {
      headers: {
        'Content-Type': 'application/json',
        'x-access-key': '8f2a61c94d7e3b5f9c0a8d2e6b4f1c7a'
      }
    });

    console.log('✅ Payment created successfully');
    console.log('Payment ID:', response.data._id);
    console.log('Payment URL:', response.data.slickpayPaymentUrl);
    console.log('Development Mode:', response.data.metadata?.isDevelopmentMode);
    console.log('Alternative URLs:', response.data.metadata?.alternativeUrls?.length || 0);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error creating payment:', error.response?.data || error.message);
    return null;
  }
}

async function testForbiddenHandler(paymentId) {
  console.log('\n🧪 Testing Forbidden Handler...');
  
  try {
    const response = await axios.get(`${BASE_URL}/subscription/payment/satim-forbidden/${paymentId}`);
    
    console.log('✅ Forbidden handler working');
    console.log('Response status:', response.status);
    console.log('Response type:', response.headers['content-type']);
    
    // Check if the response contains alternative URLs
    const html = response.data;
    const hasAlternativeUrls = html.includes('Alternative Payment Options') || html.includes('url-item');
    console.log('Has alternative URLs:', hasAlternativeUrls);
    
    return hasAlternativeUrls;
  } catch (error) {
    console.error('❌ Error testing forbidden handler:', error.response?.data || error.message);
    return false;
  }
}

async function testMockPaymentForm(mdOrder) {
  console.log('\n🧪 Testing Mock Payment Form...');
  
  try {
    const response = await axios.get(`${BASE_URL}/subscription/payment/mock-satim-form/${mdOrder}`);
    
    console.log('✅ Mock payment form working');
    console.log('Response status:', response.status);
    console.log('Response type:', response.headers['content-type']);
    
    // Check if the response contains the mock form
    const html = response.data;
    const hasMockForm = html.includes('Mock SATIM Payment Gateway') || html.includes('Mode Développement');
    console.log('Has mock form:', hasMockForm);
    
    return hasMockForm;
  } catch (error) {
    console.error('❌ Error testing mock payment form:', error.response?.data || error.message);
    return false;
  }
}

async function testPaymentService() {
  console.log('\n🧪 Testing Payment Service Methods...');
  
  try {
    // Test getting payment by ID
    const payment = await testSatimPaymentCreation();
    if (!payment) {
      console.log('❌ Cannot test payment service without a valid payment');
      return;
    }

    const response = await axios.get(`${BASE_URL}/subscription/payment/${payment._id}`, {
      headers: {
        'x-access-key': '8f2a61c94d7e3b5f9c0a8d2e6b4f1c7a'
      }
    });

    console.log('✅ Payment service working');
    console.log('Retrieved payment:', response.data._id);
    console.log('Payment status:', response.data.status);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error testing payment service:', error.response?.data || error.message);
    return null;
  }
}

async function runAllTests() {
  console.log('🚀 Starting SATIM Payment Fix Tests...\n');
  
  // Test 1: Payment Creation
  const payment = await testSatimPaymentCreation();
  if (!payment) {
    console.log('❌ Payment creation failed - stopping tests');
    return;
  }

  // Test 2: Forbidden Handler
  const forbiddenHandlerWorks = await testForbiddenHandler(payment._id);
  
  // Test 3: Mock Payment Form
  const mockFormWorks = await testMockPaymentForm(payment.metadata?.mdOrder || 'test');
  
  // Test 4: Payment Service
  const paymentServiceWorks = await testPaymentService();

  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('Payment Creation:', payment ? '✅ PASS' : '❌ FAIL');
  console.log('Forbidden Handler:', forbiddenHandlerWorks ? '✅ PASS' : '❌ FAIL');
  console.log('Mock Payment Form:', mockFormWorks ? '✅ PASS' : '❌ FAIL');
  console.log('Payment Service:', paymentServiceWorks ? '✅ PASS' : '❌ FAIL');

  const allPassed = payment && forbiddenHandlerWorks && mockFormWorks && paymentServiceWorks;
  console.log('\n🎯 Overall Result:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  
  if (allPassed) {
    console.log('\n🎉 The SATIM Payment 403 Forbidden Error Fix is working correctly!');
    console.log('\n📝 Next Steps:');
    console.log('1. Test with real SATIM credentials in production');
    console.log('2. Monitor payment success rates');
    console.log('3. Check server logs for any issues');
  } else {
    console.log('\n🔧 Some tests failed. Please check:');
    console.log('1. Server is running on http://localhost:3000');
    console.log('2. Database is accessible');
    console.log('3. Environment variables are set correctly');
    console.log('4. API key is valid');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testSatimPaymentCreation,
  testForbiddenHandler,
  testMockPaymentForm,
  testPaymentService,
  runAllTests
}; 