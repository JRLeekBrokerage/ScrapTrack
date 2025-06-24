const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const shipmentController = require('../controllers/shipmentController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');

// Validation rules (can be expanded)
const createShipmentValidation = [
  body('shippingNumber').notEmpty().withMessage('Shipping Number is required').trim(),
  body('origin.city').notEmpty().withMessage('Origin city is required').trim(),
  body('destination.city').notEmpty().withMessage('Destination city is required').trim(),
  // Optional address fields (street, state, zipCode, country) are not explicitly validated here but will be accepted if provided
  body('deliveryDate').isISO8601().toDate().withMessage('Valid delivery date is required'),
  body('truckNumber').notEmpty().withMessage('Truck number is required').trim(),
  body('customer').isMongoId().withMessage('Valid Customer ID is required'), // Assuming customer is sent as ID
  // Add more validations for status, etc. as needed
];

const updateShipmentValidation = [
  param('id').isMongoId().withMessage('Valid Shipment MongoDB ID is required'),
  body('shippingNumber').optional().notEmpty().withMessage('Shipping Number cannot be empty if provided').trim(),
  body('origin.city').optional().notEmpty().withMessage('Origin city cannot be empty if origin is provided').trim(),
  body('destination.city').optional().notEmpty().withMessage('Destination city cannot be empty if destination is provided').trim(),
  body('status').optional().isIn(['pending', 'assigned', 'in-transit', 'delayed', 'delivered', 'cancelled', 'on-hold']),
  body('driver').optional().isMongoId().withMessage('Valid Driver MongoDB ID is required for driver field'),
  body('truckNumber').optional().notEmpty().withMessage('Truck number cannot be empty if provided').trim(),
  body('customer').optional().isMongoId().withMessage('Valid Customer ID is required if provided'),
  // etc.
];

// Routes

// Create a new shipment
router.post(
  '/',
  authenticateToken,
  // requirePermission('freight', 'create'), // Temporarily bypassed
  createShipmentValidation,
  shipmentController.createShipment
);

// Get all shipments (with pagination, filtering, sorting options later)
router.get(
  '/',
  authenticateToken,
  // requirePermission('freight', 'read'), // Temporarily bypassed
  shipmentController.getAllShipments
);

// Get a specific shipment by ID
router.get(
  '/:id',
  authenticateToken,
  // requirePermission('freight', 'read'), // Temporarily bypassed
  [param('id').isMongoId().withMessage('Valid Shipment MongoDB ID is required')],
  shipmentController.getShipmentById
);

// Update a shipment
router.put(
  '/:id',
  authenticateToken,
  // requirePermission('freight', 'update'), // Temporarily bypassed
  updateShipmentValidation,
  shipmentController.updateShipment
);

// Delete a shipment
router.delete(
  '/:id',
  authenticateToken,
  // requirePermission('freight', 'delete'), // Temporarily bypassed
  [param('id').isMongoId().withMessage('Valid Shipment MongoDB ID is required')],
  shipmentController.deleteShipment
);

module.exports = router;