require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

const checkUsers = async () => {
  try {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '27017';
    const dbName = process.env.DB_NAME || 'leekbrokerage_db';
    
    const mongoURI = `mongodb://${dbHost}:${dbPort}/${dbName}`;
    console.log(`Connecting to: ${mongoURI}`);
    
    await mongoose.connect(mongoURI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('MongoDB connected successfully.');

    // Find all users
    const allUsers = await User.find({});
    console.log(`\nFound ${allUsers.length} users in database:`);
    
    allUsers.forEach(user => {
      console.log(`- Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Active: ${user.isActive}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log('---');
    });

    // Try to find jrlee specifically
    const jrlee = await User.findOne({ username: 'jrlee' });
    if (jrlee) {
      console.log('\nJRLEE user details:');
      console.log(`- Username: ${jrlee.username}`);
      console.log(`- Email: ${jrlee.email}`);
      console.log(`- Active: ${jrlee.isActive}`);
      console.log(`- Role: ${jrlee.role}`);
      console.log(`- First Name: ${jrlee.firstName}`);
      console.log(`- Last Name: ${jrlee.lastName}`);
    } else {
      console.log('\nNo user found with username "jrlee"');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB disconnected.');
    process.exit();
  }
};

checkUsers();