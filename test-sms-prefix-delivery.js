/**
 * SMS Prefix Delivery Testing Script
 * 
 * This script helps diagnose SMS delivery issues for specific phone number prefixes
 * Run with: node test-sms-prefix-delivery.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test phone numbers with different prefixes
const TEST_NUMBERS = {
  // Working prefixes (reported by user)
  'Mobilis_066': '0660295655',
  'Mobilis_067': '0676123456',
  
  // Problematic prefixes (reported by user)
  'Djezzy_055': '0557123456',
  'Ooredoo_071': '0712345678',
  
  // Additional test cases
  'Djezzy_056': '0561234567',
  'Djezzy_057': '0571234567',
  'Ooredoo_070': '0701234567',
  'Ooredoo_077': '0771234567',
  'Mobilis_065': '0651234567',
  'Mobilis_068': '0681234567'
};

async function testPrefixValidation() {
  console.log('🧪 Testing Phone Number Validation by Prefix\n');
  console.log('=' .repeat(80));
  
  for (const [label, phone] of Object.entries(TEST_NUMBERS)) {
    try {
      const response = await axios.post(`${BASE_URL}/otp/validate-phone`, {
        phone: phone
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = response.data;
      console.log(`✅ ${label.padEnd(15)} | ${phone} | Valid: ${result.isValid}`);
      console.log(`   Network: ${result.cleanPhone} | Format: ${result.format}`);
      
    } catch (error) {
      console.log(`❌ ${label.padEnd(15)} | ${phone} | Error: ${error.response?.data?.message || error.message}`);
    }
    console.log('');
  }
}

async function debugPrefixDelivery() {
  console.log('\n🔍 Debugging SMS Delivery by Prefix\n');
  console.log('=' .repeat(80));
  
  for (const [label, phone] of Object.entries(TEST_NUMBERS)) {
    try {
      console.log(`\n🔍 Analyzing: ${label} (${phone})`);
      console.log('-' .repeat(50));
      
      const response = await axios.post(`${BASE_URL}/otp/debug-prefix-delivery`, {
        phone: phone
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = response.data;
      
      console.log(`📱 Phone: ${result.phone}`);
      console.log(`✅ Validation: ${result.validation.passesValidation}`);
      console.log(`🏢 Network: ${result.network.identified} (${result.network.status})`);
      console.log(`📋 Prefix: ${result.network.prefix}`);
      console.log(`⚙️  SMS Config: ${result.smsConfig.isConfigured ? 'OK' : 'ISSUE'}`);
      
      console.log(`📞 Phone Variations:`);
      result.phoneFormatting.priorityOrder.forEach(format => {
        console.log(`   ${format.priority}. ${format.format} (${format.description})`);
      });
      
      if (result.troubleshooting.likelyIssues.length > 0) {
        console.log(`⚠️  Likely Issues:`);
        result.troubleshooting.likelyIssues.forEach(issue => {
          console.log(`   • ${issue}`);
        });
      }
      
      console.log(`💡 Recommendation: ${result.phoneFormatting.recommendation}`);
      
    } catch (error) {
      console.log(`❌ Debug failed for ${label}: ${error.response?.data?.message || error.message}`);
    }
  }
}

async function testSMSConfiguration() {
  console.log('\n⚙️  Testing SMS Configuration\n');
  console.log('=' .repeat(80));
  
  try {
    const response = await axios.get(`${BASE_URL}/otp/test-sms-config`);
    const result = response.data;
    
    console.log(`Status: ${result.success ? '✅ OK' : '❌ FAIL'}`);
    console.log(`Message: ${result.message}`);
    console.log(`Environment: ${result.environment}`);
    
    if (result.details) {
      console.log(`\nDetails:`);
      console.log(`- API Reachable: ${result.details.apiReachable || 'Unknown'}`);
      console.log(`- Credentials: ${result.details.credentialsConfigured || 'Unknown'}`);
      if (result.details.balanceCheck) {
        console.log(`- Balance Check: Available`);
      }
    }
    
  } catch (error) {
    console.log(`❌ SMS Configuration test failed: ${error.response?.data?.message || error.message}`);
  }
}

async function getSMSStatus() {
  console.log('\n📊 SMS Service Status\n');
  console.log('=' .repeat(80));
  
  try {
    const response = await axios.get(`${BASE_URL}/otp/sms-status`);
    const result = response.data;
    
    console.log(`Environment: ${result.environment}`);
    console.log(`Configuration Valid: ${result.configurationValid ? '✅' : '❌'}`);
    
    console.log(`\nEnvironment Variables:`);
    Object.entries(result.environmentVariables).forEach(([key, value]) => {
      console.log(`- ${key}: ${value ? '✅ Set' : '❌ Missing'}`);
    });
    
    console.log(`\nOTP Statistics:`);
    console.log(`- Total OTPs: ${result.otpStatistics.total}`);
    console.log(`- Daily OTPs: ${result.otpStatistics.daily}`);
    console.log(`- Used OTPs: ${result.otpStatistics.used}`);
    console.log(`- Expired OTPs: ${result.otpStatistics.expired}`);
    
    if (result.recommendations.length > 0) {
      console.log(`\nRecommendations:`);
      result.recommendations.forEach(rec => console.log(`• ${rec}`));
    }
    
  } catch (error) {
    console.log(`❌ SMS Status check failed: ${error.response?.data?.message || error.message}`);
  }
}

async function testProblematicPrefixes() {
  console.log('\n🚨 Testing Problematic Prefixes (Development Mode)\n');
  console.log('=' .repeat(80));
  console.log('⚠️  Note: This will log test SMS in development mode');
  console.log('⚠️  In production mode, this WILL consume SMS credits!\n');
  
  // Focus on reported problematic prefixes
  const problematicNumbers = {
    'Djezzy_055': '0557123456',
    'Ooredoo_071': '0712345678'
  };
  
  for (const [label, phone] of Object.entries(problematicNumbers)) {
    try {
      console.log(`🧪 Testing: ${label} (${phone})`);
      
      const response = await axios.post(`${BASE_URL}/otp/test-problematic-prefix`, {
        phone: phone
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = response.data;
      
      console.log(`  Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`  Network: ${result.network}`);
      console.log(`  Prefix: ${result.prefix}`);
      console.log(`  Message: ${result.message}`);
      
      if (result.warning) {
        console.log(`  ⚠️  ${result.warning}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.response?.data?.message || error.message}`);
    }
    console.log('');
  }
}

async function runComprehensiveTest() {
  console.log('🚀 SMS Prefix Delivery Comprehensive Test');
  console.log('🕐 ' + new Date().toLocaleString());
  console.log('=' .repeat(80));
  
  // Test 1: Validation
  await testPrefixValidation();
  
  // Test 2: SMS Configuration
  await testSMSConfiguration();
  
  // Test 3: SMS Status
  await getSMSStatus();
  
  // Test 4: Debug Analysis
  await debugPrefixDelivery();
  
  // Test 5: Problematic Prefix Testing (Development mode)
  await testProblematicPrefixes();
  
  console.log('\n' + '=' .repeat(80));
  console.log('✅ Comprehensive test completed!');
  console.log('\n📋 Summary and Next Steps:');
  console.log('1. Check the debug analysis for each problematic prefix');
  console.log('2. Verify SMS configuration is working');
  console.log('3. Contact NetBeOpeN support if specific networks fail');
  console.log('4. Monitor server logs for detailed error codes');
  console.log('5. Use /test-problematic-prefix for live testing (costs credits)');
  console.log('\n💡 Key Files to Monitor:');
  console.log('- Server logs: Check for "SMS_NETWORK_FAILURE" entries');
  console.log('- Console logs: Look for "PREFIX_TEST_RESULT" entries');
  console.log('- Application logs: Check OTP service logs');
}

// Allow running specific tests
async function runSpecificTest(testName) {
  switch (testName) {
    case 'validation':
      await testPrefixValidation();
      break;
    case 'debug':
      await debugPrefixDelivery();
      break;
    case 'config':
      await testSMSConfiguration();
      break;
    case 'status':
      await getSMSStatus();
      break;
    case 'problematic':
      await testProblematicPrefixes();
      break;
    default:
      await runComprehensiveTest();
  }
}

// Command line interface
const args = process.argv.slice(2);
const testType = args[0] || 'all';

console.log(`Starting SMS prefix test: ${testType}\n`);

runSpecificTest(testType).catch(error => {
  console.error('❌ Test suite failed:', error.message);
  console.log('\n💡 Make sure your server is running on http://localhost:3000');
  console.log('💡 Start server with: npm run start:dev');
});

module.exports = {
  testPrefixValidation,
  debugPrefixDelivery,
  testSMSConfiguration,
  getSMSStatus,
  testProblematicPrefixes,
  runComprehensiveTest
};
