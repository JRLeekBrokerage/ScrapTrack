const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const customerController = require('../controllers/customerController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Validation middleware
const validateCustomerId = param('id').isMongoId().withMessage('Invalid customer ID');

const validateCreateCustomer = [
  body('companyName').notEmpty().trim().withMessage('Company name is required'),
  body('primaryContact.name').notEmpty().trim().withMessage('Primary contact name is required'),
  body('primaryContact.email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('primaryContact.phone').optional().matches(/^\+?[\d\s\-\(\)]{10,}$/).withMessage('Valid phone number is required'),
  body('billingAddress.street1').notEmpty().trim().withMessage('Street address is required'),
  body('billingAddress.city').notEmpty().trim().withMessage('City is required'),
  body('billingAddress.state').notEmpty().isLength({ min: 2, max: 2 }).toUpperCase().withMessage('Valid state code is required'),
  body('billingAddress.zipCode').notEmpty().matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code is required'),
  body('paymentTerms').optional().isIn(['Due Upon Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Custom']),
  body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a positive number'),
  body('defaultFuelSurchargeRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Fuel surcharge rate must be between 0 and 1')
];

const validateUpdateCustomer = [
  body('companyName').optional().notEmpty().trim().withMessage('Company name cannot be empty'),
  body('primaryContact.email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('primaryContact.phone').optional().matches(/^\+?[\d\s\-\(\)]{10,}$/).withMessage('Valid phone number is required'),
  body('billingAddress.state').optional().isLength({ min: 2, max: 2 }).toUpperCase().withMessage('Valid state code is required'),
  body('billingAddress.zipCode').optional().matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code is required'),
  body('creditLimit').optional().isFloat({ min: 0 }).withMessage('Credit limit must be a positive number')
];

const validateQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'prospect']).withMessage('Invalid status')
];

// Routes
// Get all customers
router.get(
  '/',
  authenticateToken,
  requirePermission('invoicing', 'read'),
  validateQuery,
  customerController.getAllCustomers
);

// Get single customer
router.get(
  '/:id',
  authenticateToken,
  requirePermission('invoicing', 'read'),
  validateCustomerId,
  customerController.getCustomerById
);

// Get customer invoices
router.get(
  '/:id/invoices',
  authenticateToken,
  requirePermission('invoicing', 'read'),
  validateCustomerId,
  customerController.getCustomerInvoices
);

// Get customer statistics
router.get(
  '/:id/statistics',
  authenticateToken,
  requirePermission('invoicing', 'read'),
  validateCustomerId,
  customerController.getCustomerStatistics
);

// Create new customer
router.post(
  '/',
  authenticateToken,
  requirePermission('invoicing', 'create'),
  validateCreateCustomer,
  customerController.createCustomer
);

// Update customer
router.put(
  '/:id',
  authenticateToken,
  requirePermission('invoicing', 'update'),
  validateCustomerId,
  validateUpdateCustomer,
  customerController.updateCustomer
);

// Delete customer
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('invoicing', 'delete'),
  validateCustomerId,
  customerController.deleteCustomer
);

module.exports = router;
