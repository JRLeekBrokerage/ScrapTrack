const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { param, body } = require('express-validator');

// Validation rules (examples, expand as needed)
const userIdValidation = [
    param('id').isMongoId().withMessage('Valid User MongoDB ID is required')
];

const updateUserValidation = [ // Add more specific validations based on what can be updated
    body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
    body('role').optional().isIn(['admin', 'manager', 'dispatcher', 'driver', 'accountant']),
    body('isActive').optional().isBoolean(),
    body('commissionRate').optional().isFloat({ min: 0, max: 1 }),
    // Password validation if allowing password change through this route
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
        .if(body('password').exists({checkFalsy: true})) // only validate if password is provided
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];


// GET /api/users - Get all users
router.get(
    '/',
    authenticateToken,
    // requirePermission('users', 'read'), // Temporarily bypassed
    userController.getAllUsers
);

// GET /api/users/:id - Get a single user by ID
router.get(
    '/:id',
    authenticateToken,
    // requirePermission('users', 'read'), // Temporarily bypassed
    userIdValidation,
    userController.getUserById
);

// PUT /api/users/:id - Update a user
router.put(
    '/:id',
    authenticateToken,
    // requirePermission('users', 'update'), // Temporarily bypassed
    userIdValidation,
    updateUserValidation,
    userController.updateUser
);

// DELETE /api/users/:id - Delete a user
router.delete(
    '/:id',
    authenticateToken,
    // requirePermission('users', 'delete'), // Temporarily bypassed
    userIdValidation,
    userController.deleteUser
);

module.exports = router;
