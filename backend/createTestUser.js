require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scraptrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Check if test user exists
    const existingUser = await User.findOne({ username: 'admin' });
    if (existingUser) {
      console.log('Test user already exists');
      process.exit(0);
    }

    // Create test admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@leekbrokerage.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      phone: '+1234567890',
      isActive: true,
      emailVerified: true
    });

    await adminUser.save();
    console.log('Test admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');

    // Create test driver user
    const driverUser = new User({
      username: 'driver1',
      email: 'driver1@leekbrokerage.com',
      password: 'driver123',
      firstName: 'John',
      lastName: 'Doe',
      role: 'driver',
      phone: '+1234567891',
      isActive: true,
      emailVerified: true
    });

    await driverUser.save();
    console.log('\nTest driver user created successfully!');
    console.log('Username: driver1');
    console.log('Password: driver123');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();
