/**
 * Test SlickPay Payment Creation
 * 
 * This script tests the SlickPay payment creation to ensure it works
 * without the 403 Forbidden errors that SATIM was causing.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test data
const testPaymentData = {
  plan: 'test-plan-id', // This will be replaced with actual plan ID
  returnUrl: 'http://localhost:3001/subscription/payment/success',
  paymentMethod: 'visa' // Use VISA to trigger SlickPay
};

async function testSlickPayPaymentCreation() {
  try {
    console.log('🧪 Testing SlickPay Payment Creation...\n');
    
    // First, let's get available subscription plans
    console.log('📋 Getting available subscription plans...');
    const plansResponse = await axios.get(`${BASE_URL}/subscription/plans`);
    
    if (plansResponse.data.success && plansResponse.data.plans.length > 0) {
      const firstPlan = plansResponse.data.plans[0];
      console.log(`✅ Found plan: ${firstPlan.name} (${firstPlan._id})`);
      
      // Update test data with actual plan ID
      testPaymentData.plan = firstPlan._id;
    } else {
      console.log('⚠️  No plans found, using test plan ID');
    }
    
    console.log('\n💳 Testing payment creation with VISA (SlickPay)...');
    console.log('Payment data:', JSON.stringify(testPaymentData, null, 2));
    
    // Create payment with VISA method (should use SlickPay)
    const paymentResponse = await axios.post(
      `${BASE_URL}/subscription/create-with-payment`,
      testPaymentData,
      {
        headers: {
          'Content-Type': 'application/json',
          // Note: In real test, you'd need authentication
          // 'Authorization': 'Bearer YOUR_TOKEN'
        }
      }
    );
    
    if (paymentResponse.data.success) {
      console.log('✅ Payment created successfully!');
      console.log('Payment ID:', paymentResponse.data.payment.id);
      console.log('Payment URL:', paymentResponse.data.payment.paymentUrl);
      console.log('Payment Method:', paymentResponse.data.payment.paymentMethod);
      console.log('Amount:', paymentResponse.data.payment.amount, paymentResponse.data.payment.currency);
      
      // Check if it's using SlickPay
      if (paymentResponse.data.payment.paymentUrl && 
          paymentResponse.data.payment.paymentUrl.includes('slick-pay')) {
        console.log('🎉 Confirmed: Using SlickPay payment gateway!');
      } else {
        console.log('ℹ️  Payment URL:', paymentResponse.data.payment.paymentUrl);
      }
      
      return true;
    } else {
      console.log('❌ Payment creation failed:', paymentResponse.data.message);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error testing SlickPay payment:', error.message);
    
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    
    return false;
  }
}

async function testDifferentPaymentMethods() {
  const paymentMethods = ['visa', 'mastercard', 'cib', 'edahabia'];
  
  console.log('\n🔧 Testing different payment methods...\n');
  
  for (const method of paymentMethods) {
    try {
      console.log(`Testing payment method: ${method.toUpperCase()}`);
      
      const testData = {
        ...testPaymentData,
        paymentMethod: method
      };
      
      const response = await axios.post(
        `${BASE_URL}/subscription/create-with-payment`,
        testData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        console.log(`✅ ${method.toUpperCase()}: Payment created successfully`);
        console.log(`   URL: ${response.data.payment.paymentUrl}`);
        
        // Determine which gateway is being used
        if (response.data.payment.paymentUrl.includes('slick-pay')) {
          console.log(`   Gateway: SlickPay`);
        } else if (response.data.payment.paymentUrl.includes('satim')) {
          console.log(`   Gateway: SATIM`);
        } else {
          console.log(`   Gateway: Unknown`);
        }
      } else {
        console.log(`❌ ${method.toUpperCase()}: ${response.data.message}`);
      }
      
    } catch (error) {
      console.log(`❌ ${method.toUpperCase()}: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
}

async function runAllTests() {
  console.log('🚀 Starting SlickPay Payment Tests...\n');
  
  // Test 1: Basic SlickPay payment creation
  const test1Result = await testSlickPayPaymentCreation();
  
  if (test1Result) {
    console.log('\n✅ Test 1 PASSED: SlickPay payment creation works!');
  } else {
    console.log('\n❌ Test 1 FAILED: SlickPay payment creation failed');
  }
  
  // Test 2: Different payment methods
  await testDifferentPaymentMethods();
  
  console.log('\n🎯 Test Summary:');
  console.log('- VISA/Mastercard should use SlickPay (no 403 errors)');
  console.log('- CIB/Edahabia may use SATIM (potential 403 errors)');
  console.log('- SlickPay is now the default for most payment methods');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testSlickPayPaymentCreation,
  testDifferentPaymentMethods,
  runAllTests
}; 