require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB, stopInMemoryDB } = require('../config/database'); // Destructure connectDB and stopInMemoryDB
const { performCustomSeed } = require('../scripts/seedTwentyPlus'); // Import the custom seeding function

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
// connectDB(); // We will call this in an async function before starting the server

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true,
  exposedHeaders: ['Content-Disposition']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'LeekBrokerage API is running',
    timestamp: new Date().toISOString()
  });
});

// Import routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/shipments', require('./routes/shipments')); // Enable shipment routes
app.use('/api/invoices', require('./routes/invoices')); // Enable invoice routes
app.use('/api/reports', require('./routes/reports')); // Enable report routes
app.use('/api/drivers', require('./routes/drivers')); // Enable driver routes
app.use('/api/users', require('./routes/users')); // Enable user management routes
app.use('/api/customers', require('./routes/customers')); // Enable customer management routes

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const startServer = async () => {
  try {
    await connectDB(); // Connect to the database

    // Seed the database if in development mode after connection
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Attempting to seed database...');
      const seedSuccessful = await performCustomSeed();
      if (seedSuccessful) {
        console.log('In-memory database seeded successfully for development.');
      } else {
        console.warn('Database seeding for development failed or was skipped. Check logs from seedDb.js.');
      }
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`LeekBrokerage API server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Access it on your local network at http://<your-local-ip>:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    await stopInMemoryDB(); // Ensure in-memory DB is stopped on startup failure
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  await stopInMemoryDB();
  // Add any other cleanup tasks here
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown); // kill
process.on('SIGINT', gracefulShutdown);  // Ctrl+C

module.exports = app;