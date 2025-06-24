const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticateToken, requireRole } = require('../middleware/auth'); // Assuming auth middleware
const { body } = require('express-validator');

// Validation rules for creating/updating a driver
const driverValidationRules = [
    body('firstName').notEmpty().withMessage('First name is required').trim().escape(),
    body('lastName').notEmpty().withMessage('Last name is required').trim().escape(),
    body('contactEmail').optional({ checkFalsy: true }).isEmail().withMessage('Must be a valid email').normalizeEmail(),
    body('contactPhone').optional({ checkFalsy: true }).isString().trim().escape(),
    body('commissionRate').isFloat({ min: 0, max: 1 }).withMessage('Commission rate must be between 0 and 1 (e.g., 0.1 for 10%)'),
    body('notes').optional().isString().trim().escape(),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false')
];

// Routes
// POST /api/drivers - Create a new driver
router.post('/',
    authenticateToken,
    requireRole('admin', 'manager'), // Changed from array to separate arguments
    driverValidationRules,
    driverController.createDriver
);

// GET /api/drivers - Get all drivers
router.get('/',
    authenticateToken,
    // requireRole('admin', 'manager', 'dispatcher'), // Example: Broader access for viewing
    driverController.getAllDrivers
);

// GET /api/drivers/:id - Get a single driver by ID
router.get('/:id',
    authenticateToken,
    // requireRole('admin', 'manager', 'dispatcher'),
    driverController.getDriverById
);

// PUT /api/drivers/:id - Update a driver
router.put('/:id',
    authenticateToken,
    requireRole('admin', 'manager'), // Changed from array to separate arguments
    driverValidationRules,
    driverController.updateDriver
);

// DELETE /api/drivers/:id - Deactivate a driver (soft delete)
router.delete('/:id',
    authenticateToken,
    requireRole('admin', 'manager'), // Changed from array to separate arguments
    driverController.deleteDriver
);

module.exports = router;