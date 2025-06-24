const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const driverSchema = new Schema({
  firstName: {
    type: String,
    required: [true, 'Driver first name is required.'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Driver last name is required.'],
    trim: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address.']
  },
  commissionRate: { // e.g., 0.10 for 10%
    type: Number,
    required: [true, 'Commission rate is required.'],
    min: 0,
    max: 1, // Assuming rate is a decimal between 0 and 1
    default: 0.0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Add any other driver-specific fields here (e.g., license number, address)
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

driverSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

driverSchema.set('toJSON', { virtuals: true });
driverSchema.set('toObject', { virtuals: true });

driverSchema.index({ lastName: 1, firstName: 1 });
driverSchema.index({ isActive: 1 });

module.exports = mongoose.model('Driver', driverSchema);