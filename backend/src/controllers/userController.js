const User = require('../models/User');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

// Get all users
const getAllUsers = async (req, res) => {
    try {
        // TODO: Add pagination, filtering, sorting as needed
        const users = await User.find().select('-password').lean(); // Exclude password
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Get All Users error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve users', error: error.message });
    }
};

// Get a single user by ID
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (error) {
        console.error('Get User By ID error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve user', error: error.message });
    }
};

// Update a user
const updateUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
        }

        const userId = req.params.id;
        const { username, email, firstName, lastName, phone, role, isActive, commissionRate, password } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update fields
        if (username) user.username = username;
        if (email) user.email = email;
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (phone) user.phone = phone;
        if (role) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;

        if (user.role === 'driver') {
            if (commissionRate !== undefined) {
                user.commissionRate = parseFloat(commissionRate);
            }
        } else {
            user.commissionRate = undefined; // Remove commission rate if not a driver
        }

        if (password) { // If a new password is provided
            user.password = password; // The pre-save hook in User model will hash it
        }

        const updatedUser = await user.save();
        const userResponse = updatedUser.toObject();
        delete userResponse.password; // Ensure password is not sent back

        res.json({ success: true, message: 'User updated successfully', data: userResponse });
    } catch (error) {
        console.error('Update User error:', error);
        if (error.code === 11000) { // Duplicate key (username/email)
            return res.status(400).json({ success: false, message: 'Username or email already exists.', error: error.message });
        }
        res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
    }
};

// Delete a user
const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // TODO: Consider what to do with shipments assigned to a deleted driver.
        // For now, just deleting the user.
        res.json({ success: true, message: 'User deleted successfully', data: { id: req.params.id } });
    } catch (error) {
        console.error('Delete User error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete user', error: error.message });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
};