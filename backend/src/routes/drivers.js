const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth'); // Assuming auth middleware might be needed

// Get all drivers
// For now, let's assume any authenticated user can fetch the list of drivers
// Adjust permissions as necessary (e.g., only dispatchers or admins)
router.get(
  '/',
  authenticateToken, // Ensures user is logged in
  // requirePermission('drivers', 'read'), // Example: Add specific permission if needed
  driverController.getAllDrivers
);

// Add other driver-specific routes here later if needed
// e.g., GET /:id, PUT /:id etc.

module.exports = router;