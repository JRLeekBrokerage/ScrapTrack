const express = require('express');
const router = express.Router();
const { query, param } = require('express-validator'); // Added param
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');

// Validation rules for commission report query parameters
const commissionReportValidation = [
  query('driverId').optional().isMongoId().withMessage('Invalid driverId format'),
  query('startDate').optional().isISO8601().toDate().withMessage('Invalid startDate format, use YYYY-MM-DD'),
  query('endDate').optional().isISO8601().toDate().withMessage('Invalid endDate format, use YYYY-MM-DD')
    .custom((value, { req }) => {
      if (req.query.startDate && value < req.query.startDate) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
];

// GET /api/reports/commission - Driver Commission Report
router.get(
  '/commission',
  authenticateToken,
  // requireRole('admin', 'manager', 'accountant'), // Or use specific permission
  // requirePermission('reports', 'read'), // Temporarily commented out for easier access
  commissionReportValidation,
  reportController.getDriverCommissionReport
);

// Validation rules for invoice report parameter
const invoiceReportValidation = [
  param('invoiceId').isMongoId().withMessage('Invalid invoiceId format'),
  query('format').optional().isIn(['json', 'pdf']).withMessage('Invalid format specified. Allowed values: json, pdf'),
];

// GET /api/reports/invoice/:invoiceId - Detailed Invoice Report
router.get(
  '/invoice/:invoiceId',
  authenticateToken,
  // requirePermission('reports', 'read'), // Temporarily bypassed
  invoiceReportValidation,
  reportController.getInvoiceReport
);

// Future report routes can be added here
// Example: GET /api/reports/invoice-summary
// Example: GET /api/reports/shipment-volume

module.exports = router;