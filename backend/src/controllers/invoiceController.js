const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Driver = require('../models/Driver');
const { validationResult } = require('express-validator');

// Get all invoices with filters and pagination
const getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      customerId,
      startDate,
      endDate,
      search,
      sortBy = 'invoiceDate',
      order = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (customerId) query.customer = customerId;
    
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }
    
    if (search) {
      query.$or = [
        { invoiceNumber: new RegExp(search, 'i') },
        { 'lineItems.shippingNumber': new RegExp(search, 'i') }
      ];
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const invoices = await Invoice.find(query)
      .populate('customer', 'companyName customerCode')
      .populate('createdBy', 'firstName lastName')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Invoice.countDocuments(query);

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
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoices',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single invoice by ID
const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('lineItems.driver', 'fullName employeeId')
      .populate('createdBy', 'firstName lastName')
      .populate('lastModifiedBy', 'firstName lastName');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Create new invoice
const createInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      customerId,
      billTo,
      projectDescription,
      lineItems,
      fuelSurchargeRate,
      deposit,
      paymentTerms,
      notes
    } = req.body;

    // Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Generate invoice number
    const invoiceNumber = await Invoice.generateInvoiceNumber();

    // Process line items
    const processedLineItems = [];
    for (const item of lineItems) {
      // Verify driver exists if provided
      if (item.driverId) {
        const driver = await Driver.findById(item.driverId);
        if (!driver) {
          return res.status(404).json({
            success: false,
            message: `Driver not found: ${item.driverId}`
          });
        }
        item.driver = driver._id;
        item.driverName = driver.fullName;
      }
      
      processedLineItems.push(item);
    }

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      customer: customerId,
      billTo: billTo || customer.companyName,
      projectDescription,
      lineItems: processedLineItems,
      fuelSurchargeRate: fuelSurchargeRate || customer.defaultFuelSurchargeRate || 0.35,
      deposit: deposit || 0,
      paymentTerms: paymentTerms || customer.paymentTerms || 'Due Upon Receipt',
      notes,
      createdBy: req.user._id
    });

    await invoice.save();

    // Update customer statistics
    await customer.updateStatistics();

    // Populate for response
    await invoice.populate('customer', 'companyName customerCode');
    await invoice.populate('lineItems.driver', 'fullName employeeId');

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update invoice
const updateInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Don't allow editing paid invoices
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit paid invoices'
      });
    }

    const updates = req.body;
    updates.lastModifiedBy = req.user._id;

    // Process line items if provided
    if (updates.lineItems) {
      const processedLineItems = [];
      for (const item of updates.lineItems) {
        if (item.driverId) {
          const driver = await Driver.findById(item.driverId);
          if (!driver) {
            return res.status(404).json({
              success: false,
              message: `Driver not found: ${item.driverId}`
            });
          }
          item.driver = driver._id;
          item.driverName = driver.fullName;
        }
        processedLineItems.push(item);
      }
      updates.lineItems = processedLineItems;
    }

    // Update invoice
    Object.assign(invoice, updates);
    await invoice.save();

    // Update customer statistics if customer changed
    if (updates.customer) {
      await Customer.findByIdAndUpdate(invoice.customer).updateStatistics();
      await Customer.findByIdAndUpdate(updates.customer).updateStatistics();
    }

    // Populate for response
    await invoice.populate('customer', 'companyName customerCode');
    await invoice.populate('lineItems.driver', 'fullName employeeId');

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete invoice
const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Don't allow deleting paid invoices
    if (invoice.status === 'paid' || invoice.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid invoices'
      });
    }

    const customerId = invoice.customer;
    await invoice.remove();

    // Update customer statistics
    await Customer.findByIdAndUpdate(customerId).updateStatistics();

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Record payment
const recordPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, paymentDate, notes } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Record payment
    await invoice.recordPayment(amount, paymentDate);

    // Add note if provided
    if (notes) {
      invoice.notes = invoice.notes ? `${invoice.notes}\n${notes}` : notes;
      await invoice.save();
    }

    // Update customer statistics
    await Customer.findByIdAndUpdate(invoice.customer).updateStatistics();

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Mark invoice as sent
const markAsSent = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    await invoice.markAsSent();

    res.json({
      success: true,
      message: 'Invoice marked as sent',
      data: invoice
    });
  } catch (error) {
    console.error('Mark as sent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark invoice as sent',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Generate invoice PDF
const generatePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('lineItems.driver', 'fullName');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // TODO: Implement PDF generation
    // For now, return the invoice data that would be used for PDF
    res.json({
      success: true,
      message: 'PDF generation not yet implemented',
      data: {
        invoice,
        companyInfo: {
          name: 'Leek Brokerage LLC',
          address: 'P.O. Box 20145, Canton, Oh 44701',
          phone: '330-324-5421',
          altPhone: '231-214-8200',
          email: 'JR.leekbrokerage@gmail.com',
          contact: 'James Randazzo'
        }
      }
    });
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get invoice statistics
const getStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);
    
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.invoiceDate = dateQuery;
    }

    const stats = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: '$invoiceTotal' },
          totalPaid: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'paid'] },
                '$invoiceTotal',
                0
              ]
            }
          },
          totalOutstanding: {
            $sum: {
              $cond: [
                { $ne: ['$paymentStatus', 'paid'] },
                { $subtract: ['$invoiceTotal', '$paidAmount'] },
                0
              ]
            }
          },
          averageInvoiceAmount: { $avg: '$invoiceTotal' },
          totalLineItems: { $sum: { $size: '$lineItems' } }
        }
      }
    ]);

    const statusCounts = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const paymentStatusCounts = await Invoice.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalInvoices: 0,
          totalRevenue: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          averageInvoiceAmount: 0,
          totalLineItems: 0
        },
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        paymentStatusBreakdown: paymentStatusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  recordPayment,
  markAsSent,
  generatePDF,
  getStatistics
};
