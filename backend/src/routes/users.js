const express = require('express');
const router = express.Router();
const { requireRole, requirePermission } = require('../middleware/auth');

// Simple users routes for now
router.get('/', requireRole('admin', 'manager'), (req, res) => {
  res.json({
    success: true,
    message: 'Users endpoint - coming soon',
    data: {
      user: req.user,
      permissions: req.user.permissions
    }
  });
});

router.get('/me', (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

module.exports = router;
