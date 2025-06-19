const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod; // To hold the in-memory server instance

const connectDB = async () => {
  try {
    let mongoURI;

    if (process.env.NODE_ENV === 'development') {
      console.log('Development environment: Starting in-memory MongoDB server...');
      mongod = await MongoMemoryServer.create();
      mongoURI = mongod.getUri();
      console.log(`In-memory MongoDB URI: ${mongoURI}`);
    } else {
      // Production or other environments - use configured MongoDB
      const dbHost = process.env.DB_HOST || 'localhost';
      const dbPort = process.env.DB_PORT || '27017';
      const dbName = process.env.DB_NAME || 'leekbrokerage_db';
      const dbUser = process.env.DB_USER;
      const dbPassword = process.env.DB_PASSWORD;

      if (process.env.MONGODB_URI) {
        mongoURI = process.env.MONGODB_URI;
      } else if (dbUser && dbPassword) {
        mongoURI = `mongodb://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?authSource=admin`;
      } else {
        mongoURI = `mongodb://${dbHost}:${dbPort}/${dbName}`;
      }
      console.log(`Connecting to persistent MongoDB: ${mongoURI}`);
    }

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB Connected successfully.');

    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
      if (mongod) {
        mongod.stop();
      }
      process.exit(1);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected.');
    });

  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    if (mongod) {
      await mongod.stop();
    }
    process.exit(1);
  }
};

// Optional: Graceful shutdown for in-memory server
const stopInMemoryDB = async () => {
  if (mongod) {
    await mongod.stop();
    console.log('In-memory MongoDB server stopped.');
  }
};

module.exports = { connectDB, stopInMemoryDB };