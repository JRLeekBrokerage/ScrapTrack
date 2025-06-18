const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const driverController = require('../controllers/driverController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Validation middleware
const validateDriverId = param('id').isMongoId().withMessage('Invalid driver ID');

const validateCreateDriver = [
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phoneNumber').notEmpty().matches(/^\+?[\d\s\-\(\)]{10,}$/).withMessage('Valid phone number is required'),
  body('address.street1').notEmpty().trim().withMessage('Street address is required'),
  body('address.city').notEmpty().trim().withMessage('City is required'),
  body('address.state').notEmpty().isLength({ min: 2, max: 2 }).toUpperCase().withMessage('Valid state code is required'),
  body('address.zipCode').notEmpty().matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code is required'),
  body('licenseNumber').notEmpty().trim().withMessage('License number is required'),
  body('licenseState').notEmpty().isLength({ min: 2, max: 2 }).toUpperCase().withMessage('Valid license state is required'),
  body('licenseExpiration').isISO8601().toDate().withMessage('Valid license expiration date is required'),
  body('licenseClass').notEmpty().isIn(['A', 'B', 'C', 'CDL-A', 'CDL-B']).withMessage('Valid license class is required'),
  body('hireDate').isISO8601().toDate().withMessage('Valid hire date is required'),
  body('emergencyContact.name').notEmpty().trim().withMessage('Emergency contact name is required'),
  body('emergencyContact.phoneNumber').notEmpty().matches(/^\+?[\d\s\-\(\)]{10,}$/).withMessage('Valid emergency contact phone is required'),
  body('commissionRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Commission rate must be between 0 and 1')
];

const validateUpdateDriver = [
  body('firstName').optional().notEmpty().trim().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().trim().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phoneNumber').optional().matches(/^\+?[\d\s\-\(\)]{10,}$/).withMessage('Valid phone number is required'),
  body('address.state').optional().isLength({ min: 2, max: 2 }).toUpperCase().withMessage('Valid state code is required'),
  body('address.zipCode').optional().matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code is required'),
  body('licenseState').optional().isLength({ min: 2, max: 2 }).toUpperCase().withMessage('Valid license state is required'),
  body('licenseExpiration').optional().isISO8601().toDate().withMessage('Valid license expiration date is required'),
  body('commissionRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Commission rate must be between 0 and 1')
];

const validateQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'terminated', 'on-leave']).withMessage('Invalid status')
];

// Routes
// Get all drivers
router.get(
  '/',
  authenticateToken,
  requirePermission('drivers', 'read'),
  validateQuery,
  driverController.getAllDrivers
);

// Get active drivers list (for dropdowns)
router.get(
  '/active',
  authenticateToken,
  requirePermission('drivers', 'read'),
  driverController.getActiveDriversList
);

// Get single driver
router.get(
  '/:id',
  authenticateToken,
  requirePermission('drivers', 'read'),
  validateDriverId,
  driverController.getDriverById
);

// Get driver commissions
router.get(
  '/:id/commissions',
  authenticateToken,
  requirePermission('drivers', 'read'),
  validateDriverId,
  driverController.getDriverCommissions
);

// Create new driver
router.post(
  '/',
  authenticateToken,
  requirePermission('drivers', 'create'),
  validateCreateDriver,
  driverController.createDriver
);

// Update driver
router.put(
  '/:id',
  authenticateToken,
  requirePermission('drivers', 'update'),
  validateDriverId,
  validateUpdateDriver,
  driverController.updateDriver
);

// Delete driver
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('drivers', 'delete'),
  validateDriverId,
  driverController.deleteDriver
);

module.exports = router;
