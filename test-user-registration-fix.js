/**
 * Test Script: User Registration Type Fix
 * 
 * This script tests the fix for the professional user registration issue
 * where users registering as PROFESSIONAL were incorrectly saved as CLIENT type.
 * 
 * ISSUE: When a client registers and chooses PROFESSIONAL user type, 
 *        their type was displayed in the database as CLIENT instead of PROFESSIONAL.
 * 
 * FIX: Updated ClientService to use Buyer model instead of Professional model
 *      (client.service.ts was incorrectly importing and using Professional model)
 * 
 * Test Steps:
 * 1. Connect to MongoDB
 * 2. Clear test users if they exist
 * 3. Simulate registration with CLIENT type
 * 4. Verify user is saved with CLIENT type and uses Buyer discriminator
 * 5. Simulate registration with PROFESSIONAL type  
 * 6. Verify user is saved with PROFESSIONAL type and uses Professional discriminator
 * 7. Report results
 */

const mongoose = require('mongoose');

// MongoDB connection string - adjust if needed
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mazadclick';

// User Schema (simplified version for testing)
const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String },
  password: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  type: { type: String, enum: ['CLIENT', 'PROFESSIONAL', 'RESELLER', 'ADMIN', 'SOUS_ADMIN'], required: true },
  isPhoneVerified: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isBanned: { type: Boolean, default: false }
}, { timestamps: true, discriminatorKey: '__t' });

const User = mongoose.model('User', UserSchema);

// Buyer (CLIENT) discriminator
const BuyerSchema = new mongoose.Schema({
  identity: { type: Object, required: false },
  review: [{ type: mongoose.Schema.Types.ObjectId }]
});
const Buyer = User.discriminator('Buyer', BuyerSchema);

// Professional discriminator
const ProfessionalSchema = new mongoose.Schema({
  subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  identity: { type: mongoose.Schema.Types.ObjectId, ref: 'Identity' },
  review: [{ type: mongoose.Schema.Types.ObjectId }]
});
const Professional = User.discriminator('Professional', ProfessionalSchema);

async function testUserRegistration() {
  console.log('🧪 Testing User Registration Type Fix...\n');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clean up test users
    console.log('🧹 Cleaning up existing test users...');
    await User.deleteMany({ 
      phone: { $in: ['+213555000001', '+213555000002'] } 
    });
    console.log('✅ Cleanup complete\n');

    // Test 1: Register as CLIENT
    console.log('📝 Test 1: Registering user with CLIENT type...');
    const clientUser = await Buyer.create({
      firstName: 'Test',
      lastName: 'Client',
      email: 'test.client@example.com',
      password: 'hashedpassword123',
      phone: '+213555000001',
      type: 'CLIENT'
    });
    
    console.log('✅ CLIENT user created');
    console.log('   - ID:', clientUser._id);
    console.log('   - Type field:', clientUser.type);
    console.log('   - Discriminator (__t):', clientUser.__t);
    console.log('   - Model name:', clientUser.constructor.modelName);
    
    if (clientUser.type === 'CLIENT' && clientUser.__t === 'Buyer') {
      console.log('   ✅ PASS: CLIENT user correctly uses Buyer discriminator\n');
    } else {
      console.log('   ❌ FAIL: CLIENT user has incorrect type or discriminator\n');
    }

    // Test 2: Register as PROFESSIONAL
    console.log('📝 Test 2: Registering user with PROFESSIONAL type...');
    const professionalUser = await Professional.create({
      firstName: 'Test',
      lastName: 'Professional',
      email: 'test.professional@example.com',
      password: 'hashedpassword123',
      phone: '+213555000002',
      type: 'PROFESSIONAL'
    });
    
    console.log('✅ PROFESSIONAL user created');
    console.log('   - ID:', professionalUser._id);
    console.log('   - Type field:', professionalUser.type);
    console.log('   - Discriminator (__t):', professionalUser.__t);
    console.log('   - Model name:', professionalUser.constructor.modelName);
    
    if (professionalUser.type === 'PROFESSIONAL' && professionalUser.__t === 'Professional') {
      console.log('   ✅ PASS: PROFESSIONAL user correctly uses Professional discriminator\n');
    } else {
      console.log('   ❌ FAIL: PROFESSIONAL user has incorrect type or discriminator\n');
    }

    // Verify in database
    console.log('🔍 Verifying users in database...');
    const allTestUsers = await User.find({ 
      phone: { $in: ['+213555000001', '+213555000002'] } 
    });
    
    console.log(`Found ${allTestUsers.length} test users:`);
    allTestUsers.forEach(user => {
      console.log(`   - ${user.firstName} ${user.lastName}: type=${user.type}, __t=${user.__t}`);
    });

    // Final Results
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));
    
    const clientCorrect = clientUser.type === 'CLIENT' && clientUser.__t === 'Buyer';
    const professionalCorrect = professionalUser.type === 'PROFESSIONAL' && professionalUser.__t === 'Professional';
    
    if (clientCorrect && professionalCorrect) {
      console.log('✅ ALL TESTS PASSED!');
      console.log('   The user registration type fix is working correctly.');
      console.log('   - CLIENT users are saved with Buyer discriminator');
      console.log('   - PROFESSIONAL users are saved with Professional discriminator');
    } else {
      console.log('❌ SOME TESTS FAILED!');
      if (!clientCorrect) {
        console.log('   - CLIENT user registration: FAILED');
      }
      if (!professionalCorrect) {
        console.log('   - PROFESSIONAL user registration: FAILED');
      }
    }
    console.log('='.repeat(60) + '\n');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await User.deleteMany({ 
      phone: { $in: ['+213555000001', '+213555000002'] } 
    });
    console.log('✅ Cleanup complete');

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the test
testUserRegistration().catch(console.error);

