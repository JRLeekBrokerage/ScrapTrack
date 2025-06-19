const User = require('../models/User');

// Get all users with the 'driver' role
const getAllDrivers = async (req, res) => {
  try {
    // Fetch users who have the role 'driver' and are active
    // Select only fields relevant for a driver listing (e.g., id, name)
    const drivers = await User.find({ role: 'driver', isActive: true })
                              .select('_id firstName lastName username email phone commissionRate'); 
    
    // We can map to a simpler structure if needed, e.g., combining firstName and lastName
    const formattedDrivers = drivers.map(driver => ({
        _id: driver._id,
        name: `${driver.firstName} ${driver.lastName}`, // Combining for easier display
        username: driver.username,
        email: driver.email,
        phone: driver.phone,
        commissionRate: driver.commissionRate
    }));

    res.json({
      success: true,
      message: 'Drivers retrieved successfully',
      data: formattedDrivers // Send the formatted list
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Add other driver-specific controller functions here later (CRUD for drivers if needed)
// For example:
// const getDriverById = async (req, res) => { ... };
// const createDriver = async (req, res) => { ... }; // This would be part of user management
// const updateDriver = async (req, res) => { ... };
// const deleteDriver = async (req, res) => { ... };


module.exports = {
  getAllDrivers,
  // getDriverById, 
  // createDriver,
  // updateDriver,
  // deleteDriver
};