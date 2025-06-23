const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const shipmentController = require('../controllers/shipmentController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');

// Validation rules (can be expanded)
const createShipmentValidation = [
  body('shipmentId').notEmpty().withMessage('Shipment ID is required').trim(),
  // Origin validation removed
  body('destination.street').notEmpty().withMessage('Destination street is required'),
  body('destination.city').notEmpty().withMessage('Destination city is required'),
  body('destination.state').notEmpty().withMessage('Destination state is required'),
  body('destination.zipCode').notEmpty().withMessage('Destination zip code is required'),
  body('deliveryDate').isISO8601().toDate().withMessage('Valid delivery date is required'),
  body('truckNumber').notEmpty().withMessage('Truck number is required').trim(),
  body('customer.name').notEmpty().withMessage('Customer name is required'),
  // Add more validations for items, status, etc. as needed
];

const updateShipmentValidation = [
  param('id').isMongoId().withMessage('Valid Shipment MongoDB ID is required'),
  // Add specific field validations for update, often optional
  body('status').optional().isIn(['pending', 'assigned', 'in-transit', 'delayed', 'delivered', 'cancelled', 'on-hold']),
  body('driver').optional().isMongoId().withMessage('Valid Driver MongoDB ID is required for driver field'),
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