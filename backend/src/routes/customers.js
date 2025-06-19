const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken, requirePermission } = require('../middleware/auth'); // Assuming requireRole might be used later
const { body, param } = require('express-validator');

// Validation rules
const customerIdValidation = [
    param('id').isMongoId().withMessage('Valid Customer MongoDB ID is required')
];

const createCustomerValidation = [
    body('name').trim().notEmpty().withMessage('Customer name is required.'),
    body('contactEmail').optional().isEmail().normalizeEmail().withMessage('Invalid email format for contact.'),
    // Add more validations for phone, address fields if necessary
];

const updateCustomerValidation = [
    body('name').optional().trim().notEmpty().withMessage('Customer name cannot be empty if provided.'),
    body('contactEmail').optional().isEmail().normalizeEmail().withMessage('Invalid email format for contact.'),
    // Add more validations
];


// POST /api/customers - Create a new customer
router.post(
    '/',
    authenticateToken,
    // requirePermission('customers', 'create'), // Temporarily bypassed
    createCustomerValidation,
    customerController.createCustomer
);

// GET /api/customers - Get all customers
router.get(
    '/',
    authenticateToken,
    // requirePermission('customers', 'read'), // Temporarily bypassed
    customerController.getAllCustomers
);

// GET /api/customers/:id - Get a single customer by ID
router.get(
    '/:id',
    authenticateToken,
    // requirePermission('customers', 'read'), // Temporarily bypassed
    customerIdValidation,
    customerController.getCustomerById
);

// PUT /api/customers/:id - Update a customer
router.put(
    '/:id',
    authenticateToken,
    // requirePermission('customers', 'update'), // Temporarily bypassed
    customerIdValidation,
    updateCustomerValidation,
    customerController.updateCustomer
);

// DELETE /api/customers/:id - Delete (deactivate) a customer
router.delete(
    '/:id',
    authenticateToken,
    // requirePermission('customers', 'delete'), // Temporarily bypassed
    customerIdValidation,
    customerController.deleteCustomer
);

module.exports = router;