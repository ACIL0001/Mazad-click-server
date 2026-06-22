import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

async function createIndexes() {
  const uri = process.env.DATABASE_URI;
  const dbName = process.env.DATABASE_NAME;
  
  if (!uri) {
    console.error('❌ DATABASE_URI not found in environment variables');
    process.exit(1);
  }

  console.log(`🔌 Connecting to MongoDB...`);
  await mongoose.connect(uri, { dbName });
  console.log('✅ Connected to MongoDB');
  
  const usersCollection = mongoose.connection.collection('users');
  
  console.log('🏗️ Creating indexes...');
  
  // Create sparse unique index on email
  try {
    await usersCollection.createIndex(
      { email: 1 },
      { unique: true, sparse: true, name: 'email_unique_sparse' }
    );
    console.log('✅ Email index created successfully');
  } catch (error) {
    if (error.code === 11000) {
      console.error('❌ Failed to create index: Duplicate emails found in database. Please resolve duplicates first.');
    } else {
      console.error('❌ Failed to create index:', error.message);
    }
  }
  
  await mongoose.disconnect();
  console.log('👋 Disconnected');
}

createIndexes().catch(console.error);
