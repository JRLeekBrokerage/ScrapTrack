const Customer = require('../models/Customer');
const { validationResult } = require('express-validator');

// Get all customers with filters and pagination
const getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'companyName',
      order = 'asc'
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { companyName: new RegExp(search, 'i') },
        { customerCode: new RegExp(search, 'i') },
        { 'primaryContact.email': new RegExp(search, 'i') }
      ];
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const customers = await Customer.find(query)
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single customer by ID
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('lastModifiedBy', 'firstName lastName');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Update statistics
    await customer.updateStatistics();

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create new customer
const createCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const customerData = {
      ...req.body,
      createdBy: req.user._id
    };

    const customer = new Customer(customerData);
    await customer.save();

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this code or email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const updates = {
      ...req.body,
      lastModifiedBy: req.user._id
    };

    Object.assign(customer, updates);
    await customer.save();

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has invoices
    const Invoice = require('../models/Invoice');
    const invoiceCount = await Invoice.countDocuments({ customer: customer._id });
    
    if (invoiceCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete customer with ${invoiceCount} existing invoices`
      });
    }

    await customer.remove();

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get customer invoices
const getCustomerInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const Invoice = require('../models/Invoice');
    
    const invoices = await Invoice.find({ customer: req.params.id })
      .sort({ invoiceDate: -1 })
      .limit(limit * 1)
      .skip(skip)
      .populate('createdBy', 'firstName lastName')
      .lean();

    const total = await Invoice.countDocuments({ customer: req.params.id });

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get customer invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer invoices',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get customer statistics
const getCustomerStatistics = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    await customer.updateStatistics();

    const Invoice = require('../models/Invoice');
    
    // Get monthly revenue for the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyRevenue = await Invoice.aggregate([
      {
        $match: {
          customer: customer._id,
          invoiceDate: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$invoiceDate' },
            month: { $month: '$invoiceDate' }
          },
          revenue: { $sum: '$invoiceTotal' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalInvoices: customer.totalInvoices,
          totalRevenue: customer.totalRevenue,
          outstandingBalance: customer.outstandingBalance,
          lastInvoiceDate: customer.lastInvoiceDate,
          customerSince: customer.customerSince,
          creditLimit: customer.creditLimit,
          rating: customer.rating
        },
        monthlyRevenue
      }
    });
  } catch (error) {
    console.error('Get customer statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerInvoices,
  getCustomerStatistics
};
