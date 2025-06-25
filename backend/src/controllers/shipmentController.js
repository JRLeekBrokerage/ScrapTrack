const Shipment = require('../models/Shipment');
const User = require('../models/User'); // For createdBy/updatedBy
const Driver = require('../models/Driver'); // Import new Driver model
const Invoice = require('../models/Invoice'); // Import Invoice model
const Customer = require('../models/Customer'); // Import Customer model for fetching fuelSurchargeRate
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

    // freightCost will be calculated by the Shipment model's pre-save hook
    // based on rate and weight.

    // Optional: Validate driver if provided (now refers to Driver model)
    if (shipmentData.driver) {
      if (!mongoose.Types.ObjectId.isValid(shipmentData.driver)) {
       return res.status(400).json({ success: false, message: 'Invalid driver ID format.' });
      }
      const driverDoc = await Driver.findById(shipmentData.driver);
      if (!driverDoc || !driverDoc.isActive) {
        return res.status(400).json({ success: false, message: 'Invalid or inactive driver ID.' });
      }
    }

    const shipment = new Shipment(shipmentData);
    await shipment.save();

    res.status(201).json({ success: true, message: 'Shipment created successfully', data: shipment });
  } catch (error) {
    console.error('Create shipment error:', error);
    if (error.code === 11000) { // Duplicate key error, likely for shippingNumber if it were unique
        return res.status(400).json({ success: false, message: 'A shipment with this Shipping Number may already exist.', error: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create shipment', error: error.message });
  }
};

// Get all shipments
const getAllShipments = async (req, res) => {
  try {
    // Basic find. Add pagination, sorting, filtering later.
    // Example: /api/shipments?status=pending&sortBy=deliveryDate:desc&page=1&limit=10
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
        sortOptions.deliveryDate = -1; // Default sort by deliveryDate descending
    }

    const shipments = await Shipment.find(query)
      .populate('driver', 'firstName lastName contactPhone commissionRate') // Populate from new Driver model
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
      .populate('driver', 'firstName lastName contactPhone commissionRate') // Populate from new Driver model
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

    // freightCost will be calculated by the Shipment model's pre-save hook
    // if rate or weight are part of updateData.

    // Optional: Validate driver if provided and changed (now refers to Driver model)
    if (updateData.driver) {
       if (updateData.driver === "" || updateData.driver === null) { // Allowing unassignment
           updateData.driver = null;
       } else if (!mongoose.Types.ObjectId.isValid(updateData.driver)) {
           return res.status(400).json({ success: false, message: 'Invalid driver ID format.' });
       } else {
           const driverDoc = await Driver.findById(updateData.driver);
           if (!driverDoc || !driverDoc.isActive) {
               return res.status(400).json({ success: false, message: 'Invalid or inactive driver ID.' });
           }
       }
    }
    // Prevent changing createdBy. _id (internal shipmentId) is protected by findByIdAndUpdate.
    // shippingNumber can be updated if provided in updateData.
    delete updateData.createdBy;

    let shipment = await Shipment.findById(req.params.id);

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // Apply updates to the fetched document
    Object.assign(shipment, updateData);
    
    // Manually mark 'rate' or 'weight' as modified if they are in updateData,
    // because Object.assign might not trigger Mongoose's internal isModified correctly for mixed type paths
    // or if the value is programmatically the same after parseFloat.
    // However, the pre-save hook checks this.isModified, which should be set by direct assignment.
    // The crucial part is that shipment.save() will trigger the pre-save hook on the instance.

    await shipment.save(); // This will trigger the pre('save') hook correctly

    // Re-populate after save if necessary, or ensure 'shipment' object is the one returned by save if it differs.
    // For simplicity, we'll use the 'shipment' object that .save() implicitly updates.
    // If population is needed on the response, re-fetch or populate manually.
    // For now, the existing populate calls after findByIdAndUpdate were for the response.
    // We need to ensure the 'shipment' variable for invoice recalc has correct populated driver.
    // Let's re-populate after save for consistency in the response.
    shipment = await Shipment.findById(shipment._id)
      .populate('driver', 'firstName lastName contactPhone commissionRate')
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');

    if (!shipment) { // Should not happen if save was successful
       return res.status(404).json({ success: false, message: 'Shipment disappeared after update' });
    }

    // If shipment's rate or weight was updated, and it's linked to an invoice, update invoice totals
    const rateOrWeightChanged = req.body.rate !== undefined || req.body.weight !== undefined;

    if (shipment.invoiceId && rateOrWeightChanged) {
      const oldInvoiceId = shipment.invoiceId;
      const oldInvoice = await Invoice.findById(oldInvoiceId).lean();

      if (oldInvoice) {
        const recreationData = {
          predefinedInvoiceNumber: oldInvoice.invoiceNumber,
          customerId: oldInvoice.customer.toString(),
          shipmentIds: oldInvoice.shipments.map(s_id => s_id.toString()),
          dueDate: oldInvoice.dueDate,
          notes: oldInvoice.notes,
          status: oldInvoice.status, // Preserve status
          createdBy: oldInvoice.createdBy ? oldInvoice.createdBy.toString() : (req.user ? req.user._id : null),
          issueDate: oldInvoice.issueDate // Preserve original issue date
        };
        
        await Invoice.findByIdAndDelete(oldInvoiceId);
        await Shipment.updateMany({ _id: { $in: recreationData.shipmentIds } }, { $set: { invoiceId: null } });

        try {
          const customerDoc = await Customer.findById(recreationData.customerId);
          if (!customerDoc) {
            throw new Error(`Customer ${recreationData.customerId} not found for invoice recreation during shipment update.`);
          }
          const customerFuelSurchargeRate = customerDoc.fuelSurchargeRate || 0;

          const shipmentsForNewInvoice = await Shipment.find({ _id: { $in: recreationData.shipmentIds } });
          if (shipmentsForNewInvoice.length !== recreationData.shipmentIds.length) {
            throw new Error('Not all original shipments found for invoice recreation during shipment update.');
          }
          
          const customerIdStr = recreationData.customerId.toString();
          for(const sh of shipmentsForNewInvoice) {
              if (sh.customer.toString() !== customerIdStr) {
                  throw new Error(`Shipment ${sh.shippingNumber} (ID: ${sh._id}) does not belong to customer ${customerDoc.name} (ID: ${customerIdStr}). Cannot recreate invoice.`);
              }
          }

          const subTotal = shipmentsForNewInvoice.reduce((sum, sh) => {
               let currentFreightCost = sh.freightCost || 0;
               if (sh._id.toString() === shipment._id.toString()) {
                   currentFreightCost = shipment.freightCost || 0;
               }
               return sum + currentFreightCost;
           }, 0);

          const fuelSurchargeAmount = parseFloat((subTotal * customerFuelSurchargeRate).toFixed(2));
          const totalAmount = parseFloat((subTotal + fuelSurchargeAmount).toFixed(2));

          const newInvoiceInstance = new Invoice({
            invoiceNumber: recreationData.predefinedInvoiceNumber,
            customer: recreationData.customerId,
            issueDate: recreationData.issueDate,
            dueDate: recreationData.dueDate,
            shipments: recreationData.shipmentIds,
            subTotal,
            fuelSurchargeRate: customerFuelSurchargeRate,
            fuelSurchargeAmount,
            totalAmount,
            status: recreationData.status,
            notes: recreationData.notes,
            createdBy: recreationData.createdBy,
          });
          
          const savedNewInvoice = await newInvoiceInstance.save();

          await Shipment.updateMany(
            { _id: { $in: recreationData.shipmentIds } },
            { $set: { invoiceId: savedNewInvoice._id } }
          );
          console.log(`[ShipmentUpdate] Invoice ${savedNewInvoice.invoiceNumber} (NewID: ${savedNewInvoice._id}) re-created due to shipment ${shipment._id} update.`);
        } catch (recreationError) {
          console.error(`[ShipmentUpdate] CRITICAL Error re-creating invoice ${recreationData.predefinedInvoiceNumber} after deleting old one. Data might be inconsistent. Error:`, recreationError);
          // Consider how to handle this critical failure. Maybe re-create the old invoice if possible? Or log extensively.
        }
      }
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