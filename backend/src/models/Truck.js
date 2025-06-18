const mongoose = require('mongoose');

// Truck Schema
const truckSchema = new mongoose.Schema({
  // Identification
  truckNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  vin: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  licensePlate: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  
  // Vehicle Information
  year: {
    type: Number,
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  make: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  color: String,
  
  // Specifications
  engineType: String,
  fuelType: {
    type: String,
    enum: ['diesel', 'gasoline', 'electric', 'hybrid', 'natural-gas'],
    default: 'diesel'
  },
  transmissionType: {
    type: String,
    enum: ['manual', 'automatic', 'semi-automatic'],
    default: 'manual'
  },
  grossVehicleWeight: Number,
  payloadCapacity: Number,
  
  // Status and Assignment
  status: {
    type: String,
    enum: ['active', 'maintenance', 'repair', 'inactive', 'retired'],
    default: 'active'
  },
  currentDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  
  // Ownership Information
  ownershipType: {
    type: String,
    enum: ['owned', 'leased', 'rented'],
    default: 'owned'
  },
  purchaseDate: Date,
  purchasePrice: Number,
  leaseEndDate: Date,
  
  // Maintenance Information
  lastServiceDate: Date,
  nextServiceDate: Date,
  lastServiceMileage: Number,
  nextServiceMileage: Number,
  currentMileage: {
    type: Number,
    default: 0
  },
  
  // Insurance Information
  insuranceProvider: String,
  insurancePolicyNumber: String,
  insuranceExpiration: Date,
  
  // Registration
  registrationExpiration: Date,
  registrationState: {
    type: String,
    uppercase: true,
    maxlength: 2
  },
  
  // Performance Metrics
  totalMiles: {
    type: Number,
    default: 0
  },
  totalDeliveries: {
    type: Number,
    default: 0
  },
  averageMPG: {
    type: Number,
    default: 0
  },
  totalFuelCost: {
    type: Number,
    default: 0
  },
  totalMaintenanceCost: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  
  // Equipment and Features
  equipment: [{
    type: String,
    enum: ['gps', 'eld', 'camera', 'refrigeration', 'lift-gate', 'pallet-jack', 'straps', 'tarps', 'chains']
  }],
  
  // Maintenance History
  maintenanceHistory: [{
    date: Date,
    mileage: Number,
    type: {
      type: String,
      enum: ['routine', 'repair', 'inspection', 'emergency']
    },
    description: String,
    cost: Number,
    vendor: String,
    nextServiceDue: Date
  }],
  
  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['registration', 'insurance', 'inspection', 'title', 'lease', 'other']
    },
    name: String,
    uploadDate: Date,
    expirationDate: Date,
    fileUrl: String
  }],
  
  // Notes
  notes: String,
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
truckSchema.index({ status: 1 });
truckSchema.index({ currentDriver: 1 });
truckSchema.index({ make: 1, model: 1 });

// Virtual for display name
truckSchema.virtual('displayName').get(function() {
  return `${this.truckNumber} - ${this.year} ${this.make} ${this.model}`;
});

// Virtual for insurance status
truckSchema.virtual('insuranceStatus').get(function() {
  if (!this.insuranceExpiration) return 'unknown';
  
  const daysUntilExpiration = Math.floor((this.insuranceExpiration - new Date()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiration < 0) return 'expired';
  if (daysUntilExpiration <= 30) return 'expiring-soon';
  if (daysUntilExpiration <= 90) return 'expiring';
  return 'valid';
});

// Virtual for registration status
truckSchema.virtual('registrationStatus').get(function() {
  if (!this.registrationExpiration) return 'unknown';
  
  const daysUntilExpiration = Math.floor((this.registrationExpiration - new Date()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiration < 0) return 'expired';
  if (daysUntilExpiration <= 30) return 'expiring-soon';
  if (daysUntilExpiration <= 90) return 'expiring';
  return 'valid';
});

// Virtual for service status
truckSchema.virtual('serviceStatus').get(function() {
  if (this.nextServiceDate) {
    const daysUntilService = Math.floor((this.nextServiceDate - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilService < 0) return 'overdue';
    if (daysUntilService <= 7) return 'due-soon';
  }
  
  if (this.nextServiceMileage && this.currentMileage) {
    const milesUntilService = this.nextServiceMileage - this.currentMileage;
    if (milesUntilService < 0) return 'overdue';
    if (milesUntilService <= 500) return 'due-soon';
  }
  
  return 'ok';
});

// Method to assign driver
truckSchema.methods.assignDriver = async function(driverId) {
  const Driver = mongoose.model('Driver');
  
  // Remove truck from previous driver if assigned
  if (this.currentDriver) {
    await Driver.findByIdAndUpdate(this.currentDriver, {
      $unset: { assignedTruck: 1, truckNumber: 1 }
    });
  }
  
  // Assign new driver
  this.currentDriver = driverId;
  
  // Update driver record
  if (driverId) {
    await Driver.findByIdAndUpdate(driverId, {
      assignedTruck: this._id,
      truckNumber: this.truckNumber
    });
  }
  
  return this.save();
};

// Method to record maintenance
truckSchema.methods.recordMaintenance = function(maintenance) {
  this.maintenanceHistory.push(maintenance);
  this.lastServiceDate = maintenance.date;
  this.lastServiceMileage = maintenance.mileage;
  
  if (maintenance.nextServiceDue) {
    this.nextServiceDate = maintenance.nextServiceDue;
  }
  
  this.totalMaintenanceCost += maintenance.cost || 0;
  
  return this.save();
};

// Method to update mileage
truckSchema.methods.updateMileage = function(mileage) {
  if (mileage > this.currentMileage) {
    this.currentMileage = mileage;
    return this.save();
  }
  return this;
};

// Method to calculate operating cost per mile
truckSchema.methods.calculateOperatingCost = function() {
  if (this.totalMiles === 0) return 0;
  
  const totalCosts = this.totalFuelCost + this.totalMaintenanceCost;
  return totalCosts / this.totalMiles;
};

// Static method to find active trucks
truckSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).populate('currentDriver').sort({ truckNumber: 1 });
};

// Static method to find trucks needing service
truckSchema.statics.findNeedingService = function() {
  const today = new Date();
  
  return this.find({
    status: { $in: ['active', 'maintenance'] },
    $or: [
      { nextServiceDate: { $lte: today } },
      { $expr: { $lte: ['$nextServiceMileage', '$currentMileage'] } }
    ]
  }).sort({ nextServiceDate: 1 });
};

// Static method to find trucks with expiring documents
truckSchema.statics.findExpiringDocuments = function(days = 30) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  
  return this.find({
    status: { $ne: 'retired' },
    $or: [
      { insuranceExpiration: { $lte: expirationDate } },
      { registrationExpiration: { $lte: expirationDate } }
    ]
  }).sort({ insuranceExpiration: 1, registrationExpiration: 1 });
};

module.exports = mongoose.model('Truck', truckSchema);
