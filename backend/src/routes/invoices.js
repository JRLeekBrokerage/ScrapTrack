const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const invoiceController = require('../controllers/invoiceController');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// Validation middleware
const validateInvoiceId = param('id').isMongoId().withMessage('Invalid invoice ID');

const validateCreateInvoice = [
  body('customerId').isMongoId().withMessage('Valid customer ID is required'),
  body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('lineItems.*.date').isISO8601().withMessage('Valid date is required for each line item'),
  body('lineItems.*.shippingNumber').notEmpty().withMessage('Shipping number is required'),
  body('lineItems.*.destination').notEmpty().withMessage('Destination is required'),
  body('lineItems.*.driverName').notEmpty().withMessage('Driver name is required'),
  body('lineItems.*.truckNumber').notEmpty().withMessage('Truck number is required'),
  body('lineItems.*.price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('lineItems.*.weight').isFloat({ min: 0 }).withMessage('Valid weight is required'),
  body('fuelSurchargeRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Fuel surcharge rate must be between 0 and 1'),
  body('deposit').optional().isFloat({ min: 0 }).withMessage('Deposit must be a positive number')
];

const validateUpdateInvoice = [
  body('lineItems').optional().isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('lineItems.*.date').optional().isISO8601().withMessage('Valid date is required'),
  body('lineItems.*.price').optional().isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('lineItems.*.weight').optional().isFloat({ min: 0 }).withMessage('Valid weight is required'),
  body('fuelSurchargeRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Fuel surcharge rate must be between 0 and 1'),
  body('deposit').optional().isFloat({ min: 0 }).withMessage('Deposit must be a positive number')
];

const validatePayment = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
  body('paymentDate').optional().isISO8601().withMessage('Valid payment date is required')
];

const validateQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  query('status').optional().isIn(['draft', 'sent', 'viewed', 'paid', 'cancelled']).withMessage('Invalid status'),
  query('paymentStatus').optional().isIn(['pending', 'partial', 'paid', 'overdue', 'cancelled']).withMessage('Invalid payment status')
];

// Routes
// Get all invoices with filters
router.get(
  '/',
  authenticateToken,
  requirePermission('invoicing', 'read'),
  validateQuery,
  invoiceController.getAllInvoices
);

// Get invoice statistics
router.get(
  '/statistics',
  authenticateToken,
  requirePermission('invoicing', 'read'),
  invoiceController.getStatistics
);

// Get single invoice
router.get(
  '/:id',
  authenticateToken,
  requirePermission('invoicing', 'read'),
  validateInvoiceId,
  invoiceController.getInvoiceById
);

// Create new invoice
router.post(
  '/',
  authenticateToken,
  requirePermission('invoicing', 'create'),
  validateCreateInvoice,
  invoiceController.createInvoice
);

// Update invoice
router.put(
  '/:id',
  authenticateToken,
  requirePermission('invoicing', 'update'),
  validateInvoiceId,
  validateUpdateInvoice,
  invoiceController.updateInvoice
);

// Delete invoice
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('invoicing', 'delete'),
  validateInvoiceId,
  invoiceController.deleteInvoice
);

// Record payment
router.post(
  '/:id/payment',
  authenticateToken,
  requirePermission('invoicing', 'update'),
  validateInvoiceId,
  validatePayment,
  invoiceController.recordPayment
);

// Mark invoice as sent
router.post(
  '/:id/send',
  authenticateToken,
  requirePermission('invoicing', 'update'),
  validateInvoiceId,
  invoiceController.markAsSent
);

// Generate PDF
router.get(
  '/:id/pdf',
  authenticateToken,
  requirePermission('invoicing', 'read'),
  validateInvoiceId,
  invoiceController.generatePDF
);

module.exports = router;
