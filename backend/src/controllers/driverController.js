const Driver = require('../models/Driver');
const { validationResult } = require('express-validator');

// Get all drivers
const getAllDrivers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'lastName',
      order = 'asc'
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { employeeId: new RegExp(search, 'i') },
        { licenseNumber: new RegExp(search, 'i') }
      ];
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const drivers = await Driver.find(query)
      .populate('assignedTruck', 'truckNumber displayName')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Driver.countDocuments(query);

    res.json({
      success: true,
      data: {
        drivers,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single driver by ID
const getDriverById = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('assignedTruck')
      .populate('userId', 'username email')
      .populate('createdBy', 'firstName lastName')
      .populate('lastModifiedBy', 'firstName lastName');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create new driver
const createDriver = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const driverData = {
      ...req.body,
      createdBy: req.user._id
    };

    const driver = new Driver(driverData);
    await driver.save();

    res.status(201).json({
      success: true,
      message: 'Driver created successfully',
      data: driver
    });
  } catch (error) {
    console.error('Create driver error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Driver with this ${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update driver
const updateDriver = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const updates = {
      ...req.body,
      lastModifiedBy: req.user._id
    };

    Object.assign(driver, updates);
    await driver.save();

    res.json({
      success: true,
      message: 'Driver updated successfully',
      data: driver
    });
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete driver
const deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check if driver has invoices
    const Invoice = require('../models/Invoice');
    const invoiceCount = await Invoice.countDocuments({ 'lineItems.driver': driver._id });
    
    if (invoiceCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete driver with ${invoiceCount} existing invoices`
      });
    }

    await driver.remove();

    res.json({
      success: true,
      message: 'Driver deleted successfully'
    });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get driver commissions
const getDriverCommissions = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    const Invoice = require('../models/Invoice');
    
    const matchQuery = {
      'lineItems.driver': driver._id,
      paymentStatus: 'paid'
    };
    
    if (startDate || endDate) {
      matchQuery.invoiceDate = {};
      if (startDate) matchQuery.invoiceDate.$gte = new Date(startDate);
      if (endDate) matchQuery.invoiceDate.$lte = new Date(endDate);
    }

    const commissions = await Invoice.aggregate([
      { $match: matchQuery },
      { $unwind: '$lineItems' },
      { $match: { 'lineItems.driver': driver._id } },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          totalAmount: { $sum: '$lineItems.amount' },
          deliveryCount: { $sum: 1 },
          invoices: { $addToSet: '$invoiceNumber' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      {
        $project: {
          period: '$_id',
          totalAmount: 1,
          deliveryCount: 1,
          invoiceCount: { $size: '$invoices' },
          commission: { $multiply: ['$totalAmount', driver.commissionRate] }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        driver: {
          id: driver._id,
          name: driver.fullName,
          employeeId: driver.employeeId,
          commissionRate: driver.commissionRate,
          commissionType: driver.commissionType
        },
        commissions
      }
    });
  } catch (error) {
    console.error('Get driver commissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve driver commissions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get active drivers (simplified list for dropdowns)
const getActiveDriversList = async (req, res) => {
  try {
    const drivers = await Driver.findActive()
      .select('_id employeeId firstName lastName fullName')
      .lean();

    res.json({
      success: true,
      data: drivers
    });
  } catch (error) {
    console.error('Get active drivers list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve active drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  getDriverCommissions,
  getActiveDriversList
};
