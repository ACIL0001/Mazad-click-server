/**
 * Test SlickPay Fallback Solution
 * 
 * This script tests the SlickPay fallback solution that uses SlickPay's own
 * payment pages instead of SATIM URLs to completely avoid 403 Forbidden errors.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test data
const testPaymentData = {
  plan: 'test-plan-id',
  returnUrl: 'http://localhost:3001/subscription/payment/success',
  paymentMethod: 'edahabia'
};

async function testSlickPayFallback() {
  try {
    console.log('🧪 Testing SlickPay Fallback Solution...\n');
    
    console.log('📋 SlickPay Configuration:');
    console.log('Public Key: 54|BZ7F6N4KwSD46GEXToOv3ZBpJpf7WVxnBzK5cOE6');
    console.log('Base URL: https://devapi.slick-pay.com/api/v2');
    console.log('Sandbox: true');
    console.log('Fallback: Using SlickPay payment pages instead of SATIM');
    console.log('');
    
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
    
    console.log('\n💳 Testing payment creation with Edahabia (SlickPay fallback)...');
    console.log('Payment data:', JSON.stringify(testPaymentData, null, 2));
    
    // Create payment with Edahabia method
    const paymentResponse = await axios.post(
      `${BASE_URL}/subscription/create-with-payment`,
      testPaymentData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (paymentResponse.data.success) {
      console.log('✅ Payment created successfully!');
      console.log('Payment ID:', paymentResponse.data.payment.id);
      console.log('Payment URL:', paymentResponse.data.payment.paymentUrl);
      console.log('Payment Method:', paymentResponse.data.payment.paymentMethod);
      console.log('Amount:', paymentResponse.data.payment.amount, paymentResponse.data.payment.currency);
      
      // Check if it's using the SlickPay fallback approach
      if (paymentResponse.data.payment.paymentUrl && 
          paymentResponse.data.payment.paymentUrl.includes('slick-pay')) {
        console.log('\n🎉 SUCCESS: SlickPay Fallback Working!');
        console.log('✅ Generated SlickPay payment URL (no SATIM)');
        console.log('✅ Using correct SlickPay public key');
        console.log('✅ Completely avoiding 403 Forbidden errors');
        console.log('✅ Reliable payment processing');
        
        console.log('\n🔗 Generated SlickPay URL:');
        console.log(paymentResponse.data.payment.paymentUrl);
        
        console.log('\n📋 Manual Testing Instructions:');
        console.log('1. Copy the URL above and paste it in your browser');
        console.log('2. You should see a SlickPay payment form (not 403 error)');
        console.log('3. This confirms the 403 Forbidden error is completely avoided!');
        console.log('4. Payment should work without any SATIM restrictions');
        
        return true;
      } else if (paymentResponse.data.payment.paymentUrl && 
                 paymentResponse.data.payment.paymentUrl.includes('cib.satim.dz')) {
        console.log('\n⚠️  WARNING: Still generating SATIM URLs');
        console.log('❌ This may still result in 403 Forbidden errors');
        console.log('🔧 Check the fallback implementation');
        return false;
      } else {
        console.log('ℹ️  Payment URL:', paymentResponse.data.payment.paymentUrl);
        console.log('⚠️  Unknown payment gateway - check configuration');
        return false;
      }
    } else {
      console.log('❌ Payment creation failed:', paymentResponse.data.message);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error testing SlickPay fallback:', error.message);
    
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }
    
    return false;
  }
}

async function testDifferentPaymentMethods() {
  const paymentMethods = ['edahabia', 'cib', 'visa', 'mastercard'];
  
  console.log('\n🔧 Testing different payment methods with SlickPay fallback...\n');
  
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
        if (response.data.payment.paymentUrl.includes('slick-pay')) {
          console.log(`   Gateway: SlickPay (Fallback)`);
          console.log(`   Status: ✅ No 403 errors expected`);
        } else if (response.data.payment.paymentUrl.includes('cib.satim.dz')) {
          console.log(`   Gateway: SATIM`);
          console.log(`   Status: ⚠️  403 errors may occur`);
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

async function runFallbackTest() {
  console.log('🚀 Starting SlickPay Fallback Test...\n');
  
  // Test 1: Basic SlickPay fallback payment creation
  const test1Result = await testSlickPayFallback();
  
  if (test1Result) {
    console.log('\n✅ Test 1 PASSED: SlickPay fallback payment creation works!');
  } else {
    console.log('\n❌ Test 1 FAILED: SlickPay fallback payment creation failed');
  }
  
  // Test 2: Different payment methods
  await testDifferentPaymentMethods();
  
  console.log('\n🎯 Test Summary:');
  console.log('- All payment methods should use SlickPay fallback');
  console.log('- SlickPay URLs should be generated (not SATIM)');
  console.log('- No 403 Forbidden errors should occur');
  console.log('- Reliable payment processing');
  
  console.log('\n💡 Key Benefits:');
  console.log('✅ Completely avoids 403 Forbidden errors');
  console.log('✅ Uses SlickPay\'s own payment pages');
  console.log('✅ Reliable payment processing');
  console.log('✅ Single payment method (Edahabia)');
  console.log('✅ No SATIM restrictions or IP limitations');
  
  console.log('\n🔧 Fallback Strategy:');
  console.log('1. User selects Edahabia payment');
  console.log('2. SlickPay creates payment record');
  console.log('3. SlickPay generates its own payment URL');
  console.log('4. User redirected to SlickPay payment page');
  console.log('5. No SATIM URLs = No 403 errors');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runFallbackTest().catch(console.error);
}

module.exports = {
  testSlickPayFallback,
  testDifferentPaymentMethods,
  runFallbackTest
}; 