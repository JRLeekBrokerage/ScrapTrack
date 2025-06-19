const Shipment = require('../models/Shipment');
const User = require('../models/User'); // For createdBy/updatedBy and driver validation
const { validationResult } = require('express-validator');
const mongoose = require('mongoose'); // Added mongoose for ObjectId conversion

// Create a new shipment
const createShipment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const shipmentData = { ...req.body, createdBy: req.user._id };

    // Optional: Validate driver if provided
    if (shipmentData.driver) {
      const driverUser = await User.findById(shipmentData.driver);
      if (!driverUser || driverUser.role !== 'driver') {
        return res.status(400).json({ success: false, message: 'Invalid driver ID or user is not a driver.' });
      }
    }

    const shipment = new Shipment(shipmentData);
    await shipment.save();

    res.status(201).json({ success: true, message: 'Shipment created successfully', data: shipment });
  } catch (error) {
    console.error('Create shipment error:', error);
    if (error.code === 11000) { // Duplicate key error (e.g. shipmentId)
        return res.status(400).json({ success: false, message: 'Shipment ID already exists.', error: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create shipment', error: error.message });
  }
};

// Get all shipments
const getAllShipments = async (req, res) => {
  try {
    // Basic find. Add pagination, sorting, filtering later.
    // Example: /api/shipments?status=pending&sortBy=pickupDate:desc&page=1&limit=10
    // Added 'invoiced' and 'customer' query parameters
    const { status, driver, sortBy, page = 1, limit = 20, invoiced, customer } = req.query;
    const query = {};
    if (status) query.status = status;

    if (driver) {
        if (mongoose.Types.ObjectId.isValid(driver)) {
            query.driver = new mongoose.Types.ObjectId(driver);
        } else {
            console.warn(`[shipmentController] Invalid driver ID format received: ${driver}`);
            // Decide handling: return error, or empty, or ignore filter. For now, ignoring.
        }
    }
    if (invoiced === 'false') {
        query.invoiceId = null;
    } else if (invoiced === 'true') {
        query.invoiceId = { $ne: null };
    }
    if (customer) {
        if (mongoose.Types.ObjectId.isValid(customer)) {
            query.customer = new mongoose.Types.ObjectId(customer);
        } else {
            console.warn(`[shipmentController] Invalid customer ID format received: ${customer}`);
            // Decide handling. For now, ignoring.
        }
    }


    const sortOptions = {};
    if (sortBy) {
        const parts = sortBy.split(':');
        sortOptions[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
        sortOptions.createdAt = -1; // Default sort
    }

    const shipments = await Shipment.find(query)
      .populate('driver', 'username firstName lastName phone') // Populate driver details
      .populate('customer', 'name contactEmail contactPhone') // Populate customer details
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean(); // Use .lean() for faster queries if not modifying docs

    const totalShipments = await Shipment.countDocuments(query);

    res.json({
      success: true,
      data: shipments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalShipments / parseInt(limit)),
        totalShipments,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all shipments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve shipments', error: error.message });
  }
};

// Get a specific shipment by ID
const getShipmentById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const shipment = await Shipment.findById(req.params.id)
      .populate('driver', 'username firstName lastName phone')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    res.json({ success: true, data: shipment });
  } catch (error) {
    console.error('Get shipment by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve shipment', error: error.message });
  }
};

// Update a shipment
const updateShipment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const updateData = { ...req.body, updatedBy: req.user._id };

    // Optional: Validate driver if provided and changed
    if (updateData.driver) {
        const driverUser = await User.findById(updateData.driver);
        if (!driverUser || driverUser.role !== 'driver') {
            return res.status(400).json({ success: false, message: 'Invalid driver ID or user is not a driver.' });
        }
    }
    // Prevent changing shipmentId or createdBy
    delete updateData.shipmentId;
    delete updateData.createdBy;


    const shipment = await Shipment.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
      .populate('driver', 'username firstName lastName phone')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    res.json({ success: true, message: 'Shipment updated successfully', data: shipment });
  } catch (error) {
    console.error('Update shipment error:', error);
     if (error.code === 11000) { 
        return res.status(400).json({ success: false, message: 'Update resulted in duplicate key.', error: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to update shipment', error: error.message });
  }
};

// Delete a shipment
const deleteShipment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const shipment = await Shipment.findByIdAndDelete(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }
    res.json({ success: true, message: 'Shipment deleted successfully', data: { id: req.params.id } });
  } catch (error) {
    console.error('Delete shipment error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete shipment', error: error.message });
  }
};

module.exports = {
  createShipment,
  getAllShipments,
  getShipmentById,
  updateShipment,
  deleteShipment
};