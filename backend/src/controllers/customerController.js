const Customer = require('../models/Customer');
const { validationResult } = require('express-validator');

// Create a new customer
const createCustomer = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
        }

        const { name, contactEmail, contactPhone, primaryAddress, notes } = req.body;
        
        // Check if customer name already exists
        const existingCustomer = await Customer.findOne({ name });
        if (existingCustomer) {
            return res.status(400).json({ success: false, message: 'Customer with this name already exists.' });
        }

        const customerData = {
            name,
            contactEmail,
            contactPhone,
            primaryAddress,
            notes,
            createdBy: req.user._id // Assuming createdBy is desired
        };

        const customer = new Customer(customerData);
        await customer.save();
        res.status(201).json({ success: true, message: 'Customer created successfully', data: customer });
    } catch (error) {
        console.error('Create Customer error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Customer name already exists.', error: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to create customer', error: error.message });
    }
};

// Get all customers
const getAllCustomers = async (req, res) => {
    try {
        // TODO: Add pagination, filtering (e.g., by isActive), sorting
        const { isActive, sortBy, page = 1, limit = 100 } = req.query; // Default limit higher for dropdowns
        const query = {};
        if (isActive !== undefined) query.isActive = isActive === 'true';


        const sortOptions = {};
        if (sortBy) {
            const parts = sortBy.split(':');
            sortOptions[parts[0]] = parts[1] === 'desc' ? -1 : 1;
        } else {
            sortOptions.name = 1; // Default sort by name
        }

        const customers = await Customer.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();
        
        const totalCustomers = await Customer.countDocuments(query);

        res.json({ 
            success: true, 
            data: customers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCustomers / parseInt(limit)),
                totalCustomers,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get All Customers error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve customers', error: error.message });
    }
};

// Get a single customer by ID
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.json({ success: true, data: customer });
    } catch (error) {
        console.error('Get Customer By ID error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve customer', error: error.message });
    }
};

// Update a customer
const updateCustomer = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
        }

        const customerId = req.params.id;
        const updateData = { ...req.body, updatedBy: req.user._id };

        // Prevent changing unique name to one that already exists (excluding itself)
        if (updateData.name) {
            const existingCustomer = await Customer.findOne({ name: updateData.name, _id: { $ne: customerId } });
            if (existingCustomer) {
                return res.status(400).json({ success: false, message: 'Another customer with this name already exists.' });
            }
        }
        
        const customer = await Customer.findByIdAndUpdate(customerId, updateData, { new: true, runValidators: true });
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.json({ success: true, message: 'Customer updated successfully', data: customer });
    } catch (error) {
        console.error('Update Customer error:', error);
         if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Customer name conflict.', error: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to update customer', error: error.message });
    }
};

// Delete a customer (soft delete by setting isActive to false is often preferred)
const deleteCustomer = async (req, res) => {
    try {
        // const customer = await Customer.findByIdAndDelete(req.params.id); // Hard delete
        const customer = await Customer.findByIdAndUpdate(req.params.id, { isActive: false, updatedBy: req.user._id }, { new: true }); // Soft delete

        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        // TODO: Consider implications for shipments/invoices linked to this customer.
        // For now, just deactivating.
        res.json({ success: true, message: 'Customer deactivated successfully', data: { id: req.params.id, isActive: customer.isActive } });
    } catch (error) {
        console.error('Delete Customer error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete customer', error: error.message });
    }
};

module.exports = {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
};