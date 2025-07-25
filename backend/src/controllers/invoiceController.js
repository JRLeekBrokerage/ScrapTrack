const Invoice = require('../models/Invoice');
const Shipment = require('../models/Shipment');
const Customer = require('../models/Customer'); // Added Customer model import
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

    // Expect customerId. fuelSurchargeRate will be fetched from the customer.
    // Added optional predefinedInvoiceNumber for recreation flow
    const { shipmentIds, customerId, dueDate, notes, predefinedInvoiceNumber } = req.body;

    if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }
    if (!shipmentIds || shipmentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one shipment ID is required.' });
    }

    // Fetch the customer to get their fuelSurchargeRate
    const customer = await Customer.findById(customerId);
    if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    const customerFuelSurchargeRate = customer.fuelSurchargeRate || 0;

    // Fetch and validate shipments
    const shipments = await Shipment.find({
      _id: { $in: shipmentIds.map(id => new mongoose.Types.ObjectId(id)) },
      status: 'delivered',
      invoiceId: null, // Ensure not already invoiced
      customer: new mongoose.Types.ObjectId(customerId) // Ensure shipments belong to the selected customer
    });

    if (shipments.length !== shipmentIds.length) {
        const foundIds = shipments.map(s => s._id.toString());
        const notFoundOrInvalid = shipmentIds.filter(id => !foundIds.includes(id));
        return res.status(400).json({
            success: false,
            message: 'One or more selected shipments are invalid for invoicing for the chosen customer (they may be already invoiced, not delivered, or belong to a different customer).',
            details: { notFoundOrInvalid }
        });
    }
    
    // Customer is now validated by the shipment query using customerId, and fetched above.

    const subTotal = shipments.reduce((sum, shipment) => sum + (shipment.freightCost || 0), 0);
    // Use customerFuelSurchargeRate fetched from the Customer document
    // const numericFuelSurchargeRate = parseFloat(fuelSurchargeRate) || 0; // Removed, using customer's rate
    // const numericDepositAmount = parseFloat(depositAmount) || 0; // Removed

    const fuelSurchargeAmount = parseFloat((subTotal * customerFuelSurchargeRate).toFixed(2));
    // Total amount calculation no longer subtracts depositAmount
    const totalAmount = parseFloat((subTotal + fuelSurchargeAmount).toFixed(2));
    const invoiceNumber = predefinedInvoiceNumber ? predefinedInvoiceNumber : await getNextInvoiceNumber();

    const newInvoice = new Invoice({
      invoiceNumber,
      customer: new mongoose.Types.ObjectId(customerId),
      issueDate: new Date(),
      // The date string from the form ("YYYY-MM-DD") is passed directly.
      // Mongoose will correctly parse this into a Date object at midnight UTC.
      dueDate: dueDate,
      shipments: shipmentIds.map(id => new mongoose.Types.ObjectId(id)),
      subTotal,
      fuelSurchargeRate: customerFuelSurchargeRate, // Save the customer's rate to the invoice
      fuelSurchargeAmount,
      // depositAmount: numericDepositAmount, // Removed
      totalAmount,
      status: 'draft',
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
    const { status, customerName, sortBy } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const queryLimit = parseInt(req.query.limit, 10) || 20; // Use req.query.limit here

    const query = {};
    if (status) query.status = status;
    // Note: billTo.name is not directly on Invoice model anymore, customer is a ref.
    // If filtering by customer name is needed, it requires a more complex query or pre-aggregation.
    // For now, removing customerName filter from here to avoid errors, or it needs to be adapted.
    // if (customerName) query['customer.name'] = new RegExp(customerName, 'i'); // This would require a lookup or $lookup

    const sortOptions = {};
    if (sortBy) {
        const parts = sortBy.split(':');
        sortOptions[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    } else {
        sortOptions.issueDate = -1; // Default sort
    }
    
    console.log('[invoiceController.js] Using Sort Options:', JSON.stringify(sortOptions));

    const invoices = await Invoice.find(query)
      .populate('shipments', 'shipmentId freightCost customer')
      .populate('customer', 'name contactEmail')
      .populate('createdBy', 'username')
      .sort(sortOptions)
      .limit(queryLimit) // Use the parsed queryLimit
      .skip((page - 1) * queryLimit) // Use the parsed page and queryLimit
      .lean();
    
    // console.log('[getAllInvoices] Found invoices count:', invoices.length);

    const totalInvoices = await Invoice.countDocuments(query);
    console.log(`[invoiceController.js] getAllInvoices: req.query.limit = ${req.query.limit}, parsed queryLimit = ${queryLimit}, totalInvoices = ${totalInvoices}`);
    
    const calculatedTotalPages = Math.ceil(totalInvoices / queryLimit);
    console.log(`[invoiceController.js] getAllInvoices: Calculated totalPages = ${calculatedTotalPages}`);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        currentPage: page,
        totalPages: calculatedTotalPages,
        totalInvoices,
        limit: queryLimit
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
      .populate('customer', 'name contactEmail contactPhone primaryAddress notes') // Populate full customer details
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

    // fuelSurchargeRate is not updatable directly on the invoice; it's set from customer at creation.
    const { invoiceNumber, status, notes, dueDate /*, depositAmount */ } = req.body; // fuelSurchargeRate removed from req.body
    const invoiceId = req.params.id;

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Recalculate totals if relevant fields change
    let needsRecalculation = false; // This might be true if subTotal could change, but not from fuelSurchargeRate here.
    // Deposit amount related check removed
    // The block for updating invoice.fuelSurchargeRate from req.body is removed.
    // It's set at creation and should not change, or if it must, it's a more complex operation (e.g., if customer changes).
    
    // If subTotal could change on update (not typical for existing invoice), add:
    // if (req.body.subTotal !== undefined && invoice.subTotal !== parseFloat(req.body.subTotal)) {
    //     invoice.subTotal = parseFloat(req.body.subTotal);
    //     needsRecalculation = true;
    // }

    if (needsRecalculation || (invoice.isNew && !invoice.totalAmount)) { // Ensure calculation runs for new docs if not already done by pre-save
        invoice.fuelSurchargeAmount = parseFloat((invoice.subTotal * invoice.fuelSurchargeRate).toFixed(2));
        // Total amount calculation no longer subtracts depositAmount
        invoice.totalAmount = parseFloat((invoice.subTotal + invoice.fuelSurchargeAmount).toFixed(2));
    }

    if (invoiceNumber && invoice.invoiceNumber !== invoiceNumber) {
        // Check if the new invoiceNumber already exists for a different invoice
        const existingInvoiceWithNewNumber = await Invoice.findOne({ invoiceNumber: invoiceNumber, _id: { $ne: invoiceId } });
        if (existingInvoiceWithNewNumber) {
            return res.status(400).json({ success: false, message: 'Invoice number already exists.' });
        }
        invoice.invoiceNumber = invoiceNumber;
    }

    if (status) invoice.status = status;
    if (notes) invoice.notes = notes;
    if (dueDate) invoice.dueDate = dueDate;
    // Note: Modifying shipments linked to an invoice is a more complex operation, not handled here.

    const updatedInvoice = await invoice.save();
    
    // Re-populate for response
    const populatedInvoice = await Invoice.findById(updatedInvoice._id)
        .populate('shipments')
        .populate('customer', 'name contactEmail contactPhone primaryAddress notes')
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