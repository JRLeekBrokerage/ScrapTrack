const mongoose = require('mongoose');

// Driver Schema
const driverSchema = new mongoose.Schema({
  // Basic Information
  employeeId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  
  // Contact Information
  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  alternatePhone: String,
  
  // Address
  address: {
    street1: {
      type: String,
      required: true
    },
    street2: String,
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true,
      uppercase: true,
      maxlength: 2
    },
    zipCode: {
      type: String,
      required: true
    }
  },
  
  // License Information
  licenseNumber: {
    type: String,
    required: true,
    unique: true
  },
  licenseState: {
    type: String,
    required: true,
    uppercase: true,
    maxlength: 2
  },
  licenseExpiration: {
    type: Date,
    required: true
  },
  licenseClass: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'CDL-A', 'CDL-B']
  },
  
  // Employment Information
  hireDate: {
    type: Date,
    required: true
  },
  terminationDate: Date,
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'terminated', 'on-leave'],
    default: 'active'
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contractor', 'owner-operator'],
    default: 'full-time'
  },
  
  // Truck Assignment
  assignedTruck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck'
  },
  truckNumber: String,
  
  // Commission Information
  commissionRate: {
    type: Number,
    required: true,
    default: 0.25, // 25%
    min: 0,
    max: 1
  },
  commissionType: {
    type: String,
    enum: ['percentage', 'flat-rate', 'per-mile', 'custom'],
    default: 'percentage'
  },
  flatRate: {
    type: Number,
    default: 0
  },
  perMileRate: {
    type: Number,
    default: 0
  },
  
  // Financial Information
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalCommissions: {
    type: Number,
    default: 0
  },
  currentPeriodEarnings: {
    type: Number,
    default: 0
  },
  lastPaymentDate: Date,
  lastPaymentAmount: {
    type: Number,
    default: 0
  },
  
  // Performance Metrics
  totalDeliveries: {
    type: Number,
    default: 0
  },
  totalMiles: {
    type: Number,
    default: 0
  },
  averageDeliveryTime: {
    type: Number,
    default: 0
  },
  onTimeDeliveryRate: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  safetyRating: {
    type: Number,
    default: 5,
    min: 1,
    max: 5
  },
  
  // Certifications and Training
  certifications: [{
    name: String,
    issueDate: Date,
    expirationDate: Date,
    issuingAuthority: String,
    certificateNumber: String
  }],
  
  // Emergency Contact
  emergencyContact: {
    name: {
      type: String,
      required: true
    },
    relationship: String,
    phoneNumber: {
      type: String,
      required: true
    },
    alternatePhone: String
  },
  
  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['license', 'medical-card', 'insurance', 'certification', 'other']
    },
    name: String,
    uploadDate: Date,
    expirationDate: Date,
    fileUrl: String
  }],
  
  // Notes and Flags
  notes: String,
  isPreferred: {
    type: Boolean,
    default: false
  },
  availableForOvertime: {
    type: Boolean,
    default: true
  },
  
  // User Account Link (if driver has system access)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
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
driverSchema.index({ firstName: 1, lastName: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ employeeId: 1 });
driverSchema.index({ licenseNumber: 1 });
driverSchema.index({ truckNumber: 1 });

// Virtual for full name
driverSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.middleName ? this.middleName + ' ' : ''}${this.lastName}`;
});

// Virtual for name (Last, First)
driverSchema.virtual('displayName').get(function() {
  return `${this.lastName}, ${this.firstName}`;
});

// Virtual for license expiration status
driverSchema.virtual('licenseExpirationStatus').get(function() {
  const daysUntilExpiration = Math.floor((this.licenseExpiration - new Date()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiration < 0) return 'expired';
  if (daysUntilExpiration <= 30) return 'expiring-soon';
  if (daysUntilExpiration <= 90) return 'expiring';
  return 'valid';
});

// Pre-save middleware to generate employee ID if not provided
driverSchema.pre('save', async function(next) {
  if (!this.employeeId && this.isNew) {
    const lastDriver = await this.constructor.findOne({}, {}, { sort: { 'employeeId': -1 } });
    if (lastDriver && lastDriver.employeeId) {
      const lastNum = parseInt(lastDriver.employeeId.replace(/\D/g, ''));
      this.employeeId = 'DRV' + String(lastNum + 1).padStart(4, '0');
    } else {
      this.employeeId = 'DRV0001';
    }
  }
  
  next();
});

// Method to calculate commission
driverSchema.methods.calculateCommission = function(amount, weight = null, miles = null) {
  switch (this.commissionType) {
    case 'percentage':
      return amount * this.commissionRate;
    case 'flat-rate':
      return this.flatRate;
    case 'per-mile':
      return miles ? miles * this.perMileRate : 0;
    case 'custom':
      // Custom logic can be implemented here
      return 0;
    default:
      return 0;
  }
};

// Method to update statistics
driverSchema.methods.updateStatistics = async function() {
  const Invoice = mongoose.model('Invoice');
  
  const stats = await Invoice.aggregate([
    { $unwind: '$lineItems' },
    { $match: { 'lineItems.driver': this._id } },
    {
      $group: {
        _id: null,
        totalDeliveries: { $sum: 1 },
        totalEarnings: { $sum: '$lineItems.amount' }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.totalDeliveries = stats[0].totalDeliveries;
    this.totalEarnings = stats[0].totalEarnings;
    this.totalCommissions = this.calculateCommission(this.totalEarnings);
  }
  
  return this.save();
};

// Static method to find active drivers
driverSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ lastName: 1, firstName: 1 });
};

// Static method to find drivers with expiring licenses
driverSchema.statics.findExpiringLicenses = function(days = 30) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  
  return this.find({
    status: 'active',
    licenseExpiration: { $lte: expirationDate }
  }).sort({ licenseExpiration: 1 });
};

module.exports = mongoose.model('Driver', driverSchema);
