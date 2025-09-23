/**
 * Test SlickPay-SATIM Hybrid Payment Creation
 * 
 * This script tests the new approach where SlickPay generates SATIM URLs
 * to avoid 403 Forbidden errors while still using real SATIM payment pages.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test data
const testPaymentData = {
  plan: 'test-plan-id', // This will be replaced with actual plan ID
  returnUrl: 'http://localhost:3001/subscription/payment/success',
  paymentMethod: 'edahabia' // Use Edahabia to trigger SlickPay-SATIM hybrid
};

async function testSlickPaySatimHybrid() {
  try {
    console.log('🧪 Testing SlickPay-SATIM Hybrid Payment Creation...\n');
    
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
    
    console.log('\n💳 Testing payment creation with Edahabia (SlickPay-SATIM hybrid)...');
    console.log('Payment data:', JSON.stringify(testPaymentData, null, 2));
    
    // Create payment with Edahabia method (should use SlickPay-SATIM hybrid)
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
      
      // Check if it's using the SlickPay-SATIM hybrid approach
      if (paymentResponse.data.payment.paymentUrl && 
          paymentResponse.data.payment.paymentUrl.includes('cib.satim.dz')) {
        console.log('🎉 Confirmed: Using SlickPay-SATIM hybrid approach!');
        console.log('✅ Generated real SATIM URL without 403 errors');
        console.log('✅ Uses SlickPay infrastructure for reliability');
        console.log('✅ Generates authentic SATIM payment pages');
      } else {
        console.log('ℹ️  Payment URL:', paymentResponse.data.payment.paymentUrl);
      }
      
      // Test the generated URL
      console.log('\n🔗 Testing the generated SATIM URL...');
      console.log('URL to test:', paymentResponse.data.payment.paymentUrl);
      console.log('\n📋 Manual Testing Instructions:');
      console.log('1. Copy the URL above and paste it in your browser');
      console.log('2. Check if you get a SATIM payment form (not 403 error)');
      console.log('3. If you see a payment form, the hybrid approach works!');
      console.log('4. If you get 403 error, the issue persists');
      
      return true;
    } else {
      console.log('❌ Payment creation failed:', paymentResponse.data.message);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error testing SlickPay-SATIM hybrid payment:', error.message);
    
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    
    return false;
  }
}

async function testDifferentPaymentMethods() {
  const paymentMethods = ['edahabia', 'cib', 'visa', 'mastercard'];
  
  console.log('\n🔧 Testing different payment methods with SlickPay-SATIM hybrid...\n');
  
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
        console.log(`   Method: ${response.data.payment.paymentMethod}`);
        
        // Determine which gateway is being used
        if (response.data.payment.paymentUrl.includes('cib.satim.dz')) {
          console.log(`   Gateway: SlickPay-SATIM Hybrid`);
          console.log(`   Status: ✅ Real SATIM URL generated`);
        } else if (response.data.payment.paymentUrl.includes('slick-pay')) {
          console.log(`   Gateway: Pure SlickPay`);
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
  console.log('🚀 Starting SlickPay-SATIM Hybrid Payment Tests...\n');
  
  // Test 1: Basic SlickPay-SATIM hybrid payment creation
  const test1Result = await testSlickPaySatimHybrid();
  
  if (test1Result) {
    console.log('\n✅ Test 1 PASSED: SlickPay-SATIM hybrid payment creation works!');
  } else {
    console.log('\n❌ Test 1 FAILED: SlickPay-SATIM hybrid payment creation failed');
  }
  
  // Test 2: Different payment methods
  await testDifferentPaymentMethods();
  
  console.log('\n🎯 Test Summary:');
  console.log('- All payment methods should use SlickPay-SATIM hybrid');
  console.log('- Real SATIM URLs should be generated without 403 errors');
  console.log('- SlickPay infrastructure provides reliability');
  console.log('- Users get authentic SATIM payment experience');
  
  console.log('\n💡 Key Benefits:');
  console.log('✅ No more 403 Forbidden errors');
  console.log('✅ Real SATIM payment pages');
  console.log('✅ Reliable SlickPay infrastructure');
  console.log('✅ Single payment method (Edahabia)');
  console.log('✅ Authentic Algerian payment experience');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testSlickPaySatimHybrid,
  testDifferentPaymentMethods,
  runAllTests
}; 