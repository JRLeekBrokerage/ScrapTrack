const Driver = require('../models/Driver');
const { validationResult } = require('express-validator');

// Create a new driver
const createDriver = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
        }

        const { firstName, lastName, contactPhone, contactEmail, commissionRate, notes, isActive } = req.body;
        
        // Consider checking for duplicate drivers if necessary (e.g., by name or email)
        // const existingDriver = await Driver.findOne({ firstName, lastName, contactPhone });
        // if (existingDriver) {
        //     return res.status(400).json({ success: false, message: 'A driver with similar details already exists.' });
        // }

        const driverData = {
            firstName,
            lastName,
            contactPhone,
            contactEmail,
            commissionRate,
            notes,
            isActive,
            createdBy: req.user ? req.user._id : null // Assuming req.user is populated by auth middleware
        };

        const driver = new Driver(driverData);
        await driver.save();
        res.status(201).json({ success: true, message: 'Driver created successfully', data: driver });
    } catch (error) {
        console.error('Create Driver error:', error);
        res.status(500).json({ success: false, message: 'Failed to create driver', error: error.message });
    }
};

// Get all drivers
const getAllDrivers = async (req, res) => {
    try {
        const { isActive, sortBy, page = 1, limit = 100 } = req.query;
        const query = {};
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const sortOptions = {};
        if (sortBy) {
            const parts = sortBy.split(':');
            sortOptions[parts[0]] = parts[1] === 'desc' ? -1 : 1;
        } else {
            sortOptions.lastName = 1; // Default sort
            sortOptions.firstName = 1;
        }

        const drivers = await Driver.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean(); // Use lean for performance if not modifying docs
        
        const totalDrivers = await Driver.countDocuments(query);

        res.json({ 
            success: true, 
            data: drivers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalDrivers / parseInt(limit)),
                totalDrivers,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Get All Drivers error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve drivers', error: error.message });
    }
};

// Get a single driver by ID
const getDriverById = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }
        res.json({ success: true, data: driver });
    } catch (error) {
        console.error('Get Driver By ID error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve driver', error: error.message });
    }
};

// Update a driver
const updateDriver = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
        }

        const driverId = req.params.id;
        const updateData = { ...req.body, updatedBy: req.user ? req.user._id : null };
        
        // Remove fields that shouldn't be updated directly or are immutable if necessary
        // delete updateData.createdBy; 

        const driver = await Driver.findByIdAndUpdate(driverId, updateData, { new: true, runValidators: true });
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }
        res.json({ success: true, message: 'Driver updated successfully', data: driver });
    } catch (error) {
        console.error('Update Driver error:', error);
        res.status(500).json({ success: false, message: 'Failed to update driver', error: error.message });
    }
};

// Delete a driver (soft delete by setting isActive to false)
const deleteDriver = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(req.params.id, { isActive: false, updatedBy: req.user ? req.user._id : null }, { new: true });
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }
        res.json({ success: true, message: 'Driver deactivated successfully', data: { id: req.params.id, isActive: driver.isActive } });
    } catch (error) {
        console.error('Delete Driver error:', error);
        res.status(500).json({ success: false, message: 'Failed to deactivate driver', error: error.message });
    }
};

module.exports = {
    createDriver,
    getAllDrivers,
    getDriverById,
    updateDriver,
    deleteDriver
};