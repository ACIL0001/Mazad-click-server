/**
 * SATIM Test URLs Generator
 * 
 * This script generates all possible SATIM test URLs with different merchant IDs
 * and URL patterns for manual testing to find which ones work.
 */

// Test merchant IDs that might work with SATIM
const TEST_MERCHANT_IDS = [
  'TESTMERCHANT',  // Standard test merchant
  'DEMO',          // Demo merchant
  'SANDBOX',       // Sandbox merchant
  'CIB_TEST',      // CIB test merchant
  'EDAHABIA_TEST', // Edahabia test merchant
  'SATIM_DEMO',    // SATIM demo merchant
  'TEST_CIB',      // Test CIB merchant
  'TEST_EDAHABIA', // Test Edahabia merchant
  'SATIMTEST',     // Alternative test merchant
  'TEST',          // Simple test merchant
  'DEV',           // Development merchant
  'STAGE',         // Staging merchant
  'UAT',           // User acceptance testing merchant
  'ALPHA',         // Alpha test merchant
  'BETA',          // Beta test merchant
];

// Test domains that might host SATIM payment pages
const SATIM_DOMAINS = [
  'cib.satim.dz',
  'satim.dz',
  'test.satim.dz',
  'sandbox.satim.dz',
  'dev.satim.dz',
  'staging.satim.dz',
  'pay.satim.dz',
  'secure.satim.dz',
  'gateway.satim.dz',
  'payment.satim.dz',
];

// URL patterns for SATIM payment pages
const URL_PATTERNS = [
  // Pattern 1: Standard merchant path
  (domain, merchantId, mdOrder, amount, currency) => 
    `https://${domain}/payment/merchants/${merchantId}/payment_fr.html?mdOrder=${mdOrder}&amount=${amount}&currency=${currency}`,
  
  // Pattern 2: Direct merchant path
  (domain, merchantId, mdOrder, amount, currency) => 
    `https://${domain}/payment/${merchantId}/payment_fr.html?mdOrder=${mdOrder}&amount=${amount}`,
  
  // Pattern 3: Process path
  (domain, merchantId, mdOrder, amount, currency) => 
    `https://${domain}/payment/process?merchant=${merchantId}&order=${mdOrder}&amount=${amount}`,
  
  // Pattern 4: Gateway path
  (domain, merchantId, mdOrder, amount, currency) => 
    `https://${domain}/payment/gateway?merchantId=${merchantId}&mdOrder=${mdOrder}`,
  
  // Pattern 5: Simple payment path
  (domain, merchantId, mdOrder, amount, currency) => 
    `https://${domain}/payment/${merchantId}?mdOrder=${mdOrder}&amount=${amount}`,
  
  // Pattern 6: API path
  (domain, merchantId, mdOrder, amount, currency) => 
    `https://${domain}/api/payment/${merchantId}?mdOrder=${mdOrder}&amount=${amount}`,
  
  // Pattern 7: Checkout path
  (domain, merchantId, mdOrder, amount, currency) => 
    `https://${domain}/checkout/${merchantId}?mdOrder=${mdOrder}&amount=${amount}`,
  
  // Pattern 8: Transaction path
  (domain, merchantId, mdOrder, amount, currency) => 
    `https://${domain}/transaction/${merchantId}?mdOrder=${mdOrder}&amount=${amount}`,
];

// Generate test data
const generateTestData = () => {
  const mdOrder = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const amount = 800000; // 8000 DZD in centimes
  const currency = '012'; // DZD currency code
  
  return { mdOrder, amount, currency };
};

// Generate all possible URLs
const generateAllUrls = () => {
  const { mdOrder, amount, currency } = generateTestData();
  const urls = [];
  
  console.log('🔗 Generating all possible SATIM test URLs...\n');
  console.log(`Test Data: mdOrder=${mdOrder}, amount=${amount}, currency=${currency}\n`);
  
  let urlIndex = 1;
  
  for (const merchantId of TEST_MERCHANT_IDS) {
    for (const domain of SATIM_DOMAINS) {
      for (const pattern of URL_PATTERNS) {
        try {
          const url = pattern(domain, merchantId, mdOrder, amount, currency);
          urls.push({
            index: urlIndex++,
            merchantId,
            domain,
            url,
            pattern: pattern.name || 'Custom Pattern'
          });
        } catch (error) {
          console.error(`Error generating URL for ${merchantId} on ${domain}:`, error.message);
        }
      }
    }
  }
  
  return urls;
};

// Display URLs in a formatted way
const displayUrls = (urls) => {
  console.log(`📋 Generated ${urls.length} test URLs:\n`);
  console.log('='.repeat(100));
  
  for (const urlData of urls) {
    console.log(`${urlData.index.toString().padStart(3, '0')}. ${urlData.merchantId} @ ${urlData.domain}`);
    console.log(`    ${urlData.url}`);
    console.log('');
  }
  
  console.log('='.repeat(100));
  console.log(`\n🎯 Total URLs generated: ${urls.length}`);
  console.log(`📝 Test merchant IDs used: ${TEST_MERCHANT_IDS.length}`);
  console.log(`🌐 Test domains used: ${SATIM_DOMAINS.length}`);
  console.log(`🔧 URL patterns used: ${URL_PATTERNS.length}`);
};

// Generate URLs for specific merchant (for focused testing)
const generateUrlsForMerchant = (merchantId) => {
  const { mdOrder, amount, currency } = generateTestData();
  const urls = [];
  
  console.log(`🔗 Generating URLs for merchant: ${merchantId}\n`);
  console.log(`Test Data: mdOrder=${mdOrder}, amount=${amount}, currency=${currency}\n`);
  
  let urlIndex = 1;
  
  for (const domain of SATIM_DOMAINS) {
    for (const pattern of URL_PATTERNS) {
      try {
        const url = pattern(domain, merchantId, mdOrder, amount, currency);
        urls.push({
          index: urlIndex++,
          merchantId,
          domain,
          url,
          pattern: pattern.name || 'Custom Pattern'
        });
      } catch (error) {
        console.error(`Error generating URL for ${merchantId} on ${domain}:`, error.message);
      }
    }
  }
  
  return urls;
};

// Export functions for use in other scripts
module.exports = {
  generateAllUrls,
  generateUrlsForMerchant,
  TEST_MERCHANT_IDS,
  SATIM_DOMAINS,
  URL_PATTERNS
};

// Run if this script is executed directly
if (require.main === module) {
  const urls = generateAllUrls();
  displayUrls(urls);
  
  console.log('\n📋 Quick Test URLs (Most Likely to Work):');
  console.log('='.repeat(80));
  
  // Show the most likely URLs to work first
  const mostLikelyUrls = urls.filter(u => 
    u.domain === 'cib.satim.dz' && 
    ['TESTMERCHANT', 'DEMO', 'SANDBOX'].includes(u.merchantId) &&
    u.url.includes('/payment/merchants/')
  ).slice(0, 10);
  
  for (const urlData of mostLikelyUrls) {
    console.log(`${urlData.index.toString().padStart(3, '0')}. ${urlData.url}`);
  }
  
  console.log('\n💡 Instructions:');
  console.log('1. Copy and paste each URL into your browser');
  console.log('2. Check if you get a payment form or a 403 error');
  console.log('3. Note which URLs work and which don\'t');
  console.log('4. If you get a 403 error, try the next URL');
  console.log('5. If you get a payment form, that URL pattern works!');
  
  console.log('\n🚨 Important Notes:');
  console.log('- Some URLs may only work from Algerian IP addresses');
  console.log('- Test environment may be temporarily unavailable');
  console.log('- Contact SATIM support if all URLs return 403 errors');
  console.log('- The working URL pattern can be used in your application');
} 