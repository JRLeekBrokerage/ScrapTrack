const Invoice = require('../models/Invoice');
const Shipment = require('../models/Shipment');
const User = require('../models/User'); // For createdBy
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Helper function to generate next invoice number (example)
async function getNextInvoiceNumber() {
  const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
  let nextNumber = 1;
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const match = lastInvoice.invoiceNumber.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0]) + 1;
    }
  }
  // Format: INV-YYYY-NNNN
  const year = new Date().getFullYear();
  return `INV-${year}-${String(nextNumber).padStart(4, '0')}`;
}

// POST /api/invoices - Create a new invoice
const createInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { shipmentIds, customerName, customerContactEmail, dueDate, fuelSurchargeRate = 0, depositAmount = 0, notes } = req.body;

    if (!shipmentIds || shipmentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one shipment ID is required.' });
    }

    // Fetch and validate shipments
    const shipments = await Shipment.find({ 
      _id: { $in: shipmentIds.map(id => new mongoose.Types.ObjectId(id)) },
      status: 'delivered',
      invoiceId: null // Ensure not already invoiced
    }).populate('customer'); // Assuming customer details are on shipment or to validate consistency

    if (shipments.length !== shipmentIds.length) {
      const foundIds = shipments.map(s => s._id.toString());
      const notFoundOrInvalid = shipmentIds.filter(id => !foundIds.includes(id));
      return res.status(400).json({ 
        success: false, 
        message: 'One or more shipments are invalid, not delivered, or already invoiced.',
        details: { notFoundOrInvalid }
      });
    }

    // Ensure all shipments belong to the same customer (if customer details are on shipment)
    // For simplicity, we'll use the provided customerName or the first shipment's customer
    let billToName = customerName;
    let billToContactEmail = customerContactEmail;

    if (!billToName && shipments.length > 0 && shipments[0].customer) {
        billToName = shipments[0].customer.name;
        billToContactEmail = shipments[0].customer.contactEmail;
    }
    if (!billToName) {
        return res.status(400).json({ success: false, message: 'Customer name is required for the invoice.' });
    }


    const subTotal = shipments.reduce((sum, shipment) => sum + (shipment.freightCost || 0), 0);
    const numericFuelSurchargeRate = parseFloat(fuelSurchargeRate) || 0;
    const numericDepositAmount = parseFloat(depositAmount) || 0;

    const fuelSurchargeAmount = parseFloat((subTotal * numericFuelSurchargeRate).toFixed(2));
    const totalAmount = parseFloat(((subTotal + fuelSurchargeAmount) - numericDepositAmount).toFixed(2));
    const invoiceNumber = await getNextInvoiceNumber();

    const newInvoice = new Invoice({
      invoiceNumber,
      billTo: {
        name: billToName,
        contactEmail: billToContactEmail,
      },
      issueDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      shipments: shipmentIds.map(id => new mongoose.Types.ObjectId(id)),
      subTotal,
      fuelSurchargeRate: numericFuelSurchargeRate,
      fuelSurchargeAmount,
      depositAmount: numericDepositAmount,
      totalAmount,
      status: 'draft', // Default status
      notes,
      createdBy: req.user._id,
    });

    const savedInvoice = await newInvoice.save();

    // Update shipments with the new invoiceId
    await Shipment.updateMany(
      { _id: { $in: shipmentIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { $set: { invoiceId: savedInvoice._id } }
    );

    res.status(201).json({ success: true, message: 'Invoice created successfully', data: savedInvoice });

  } catch (error) {
    console.error('Create Invoice error:', error);
    if (error.code === 11000) { // Duplicate key error for invoiceNumber
        return res.status(400).json({ success: false, message: 'Invoice number conflict. Please try again.', error: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create invoice', error: error.message });
  }
};

// GET /api/invoices - Get all invoices
const getAllInvoices = async (req, res) => {
  try {
    // Basic find. Add pagination, filtering (by status, customer), sorting later.
    const { status, customerName, sortBy, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (customerName) query['billTo.name'] = new RegExp(customerName, 'i'); // Case-insensitive search

    const sortOptions = {};
    if (sortBy) {
        const parts = sortBy.split(':');
        sortOptions[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
        sortOptions.issueDate = -1; // Default sort
    }
    
    console.log('[getAllInvoices] Query object:', JSON.stringify(query));
    console.log('[getAllInvoices] Sort options:', JSON.stringify(sortOptions));
    console.log('[getAllInvoices] Page:', page, 'Limit:', limit);

    const invoices = await Invoice.find(query)
      .populate('shipments', 'shipmentId freightCost') // Populate some shipment details
      .populate('createdBy', 'username')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    console.log('[getAllInvoices] Found invoices count:', invoices.length);
    // console.log('[getAllInvoices] First found invoice (if any):', invoices.length > 0 ? invoices[0] : 'None');


    const totalInvoices = await Invoice.countDocuments(query);
    console.log('[getAllInvoices] Total documents matching query in DB:', totalInvoices);
    
    res.json({
      success: true,
      data: invoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalInvoices / parseInt(limit)),
        totalInvoices,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get All Invoices error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve invoices', error: error.message });
  }
};

// GET /api/invoices/:id - Get a specific invoice by ID
const getInvoiceById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }
    const invoice = await Invoice.findById(req.params.id)
      .populate('shipments') // Populate full shipment details
      .populate('createdBy', 'username');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Get Invoice By ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve invoice', error: error.message });
  }
};

// PUT /api/invoices/:id - Update an invoice
const updateInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { status, notes, dueDate, depositAmount, fuelSurchargeRate } = req.body;
    const invoiceId = req.params.id;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Recalculate totals if relevant fields change
    let needsRecalculation = false;
    if (depositAmount !== undefined && invoice.depositAmount !== parseFloat(depositAmount)) {
        invoice.depositAmount = parseFloat(depositAmount);
        needsRecalculation = true;
    }
    if (fuelSurchargeRate !== undefined && invoice.fuelSurchargeRate !== parseFloat(fuelSurchargeRate)) {
        invoice.fuelSurchargeRate = parseFloat(fuelSurchargeRate);
        needsRecalculation = true;
    }
    
    if (needsRecalculation) {
        invoice.fuelSurchargeAmount = parseFloat((invoice.subTotal * invoice.fuelSurchargeRate).toFixed(2));
        invoice.totalAmount = parseFloat(((invoice.subTotal + invoice.fuelSurchargeAmount) - invoice.depositAmount).toFixed(2));
    }

    if (status) invoice.status = status;
    if (notes) invoice.notes = notes;
    if (dueDate) invoice.dueDate = new Date(dueDate);
    // Note: Modifying shipments linked to an invoice is a more complex operation, not handled here.

    const updatedInvoice = await invoice.save();
    
    // Re-populate for response
    const populatedInvoice = await Invoice.findById(updatedInvoice._id)
        .populate('shipments')
        .populate('createdBy', 'username');

    res.json({ success: true, message: 'Invoice updated successfully', data: populatedInvoice });
  } catch (error) {
    console.error('Update Invoice error:', error);
    res.status(500).json({ success: false, message: 'Failed to update invoice', error: error.message });
  }
};


// DELETE /api/invoices/:id - Delete an invoice (soft delete or full delete)
// For now, a placeholder. Consider implications: unlinking shipments?
const deleteInvoice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }
    const invoiceId = req.params.id;
    
    // Important: Decide on deletion strategy.
    // 1. Full delete: Remove invoice, update shipments to set invoiceId = null
    // 2. Soft delete: Mark invoice as 'void' or 'deleted' but keep record.

    // Example: Full delete strategy
    const invoice = await Invoice.findByIdAndDelete(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    // Unlink shipments
    await Shipment.updateMany({ invoiceId: invoice._id }, { $unset: { invoiceId: "" } });

    res.json({ success: true, message: 'Invoice deleted and shipments unlinked successfully', data: { id: invoiceId } });
  } catch (error) {
    console.error('Delete Invoice error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete invoice', error: error.message });
  }
};


module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
};