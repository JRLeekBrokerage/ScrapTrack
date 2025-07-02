require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

// Production user data
const productionUsers = [
  {
    username: 'jrlee',
    email: 'jrlee@leekbrokerage.com',
    password: 'Cowboy',
    firstName: 'JR',
    lastName: 'Lee',
    role: 'admin',
    phone: '555-000-0001',
    commissionRate: 0.00,
    permissions: [
      { module: 'freight', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'drivers', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'invoicing', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'reports', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'users', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'settings', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'scrap', actions: ['create', 'read', 'update', 'delete', 'export'] }
    ]
  },
  {
    username: 'admin',
    email: 'admin@leekbrokerage.com',
    password: 'Western1!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    phone: '555-000-0002',
    commissionRate: 0.00,
    permissions: [
      { module: 'freight', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'drivers', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'invoicing', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'reports', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'users', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'settings', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'scrap', actions: ['create', 'read', 'update', 'delete', 'export'] }
    ]
  }
];

const seedProductionUsers = async () => {
  try {
    console.log('Starting production user seeding...');

    // Check if users already exist
    const existingUsers = await User.find({ 
      username: { $in: productionUsers.map(u => u.username) } 
    });

    if (existingUsers.length > 0) {
      console.log('Production users already exist:');
      existingUsers.forEach(user => {
        console.log(`- ${user.username} (${user.email})`);
      });
      console.log('Overwriting existing users...');
      
      // Remove existing users
      await User.deleteMany({ 
        username: { $in: productionUsers.map(u => u.username) } 
      });
      console.log('Existing production users removed.');
    }

    // Hash passwords and create users
    console.log('Creating production users with hashed passwords...');
    const processedUsers = await Promise.all(productionUsers.map(async (user) => {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      return { ...user, password: hashedPassword };
    }));

    const createdUsers = await User.insertMany(processedUsers);
    console.log(`${createdUsers.length} production users created successfully:`);
    
    createdUsers.forEach(user => {
      console.log(`✓ ${user.username} - ${user.firstName} ${user.lastName} (${user.email})`);
    });

    console.log('\n=== PRODUCTION LOGIN CREDENTIALS ===');
    console.log('Username: jrlee     | Password: Cowboy');
    console.log('Username: admin     | Password: Western1!');
    console.log('=====================================\n');

    console.log('Production user seeding completed successfully!');
    return true;

  } catch (error) {
    console.error('Error during production seeding:', error);
    return false;
  }
};

// Main execution when run directly
if (require.main === module) {
  console.log('Running production user seeding script...');
  
  const connectAndSeed = async () => {
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

      const success = await seedProductionUsers();
      
      if (success) {
        console.log('Production seeding completed successfully!');
      } else {
        console.log('Production seeding failed.');
      }

    } catch (error) {
      console.error('MongoDB connection or seeding error:', error);
    } finally {
      await mongoose.disconnect();
      console.log('MongoDB disconnected.');
      process.exit();
    }
  };

  connectAndSeed();
}

module.exports = { seedProductionUsers };