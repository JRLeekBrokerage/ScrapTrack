const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'USA' }
}, { _id: false });

// shipmentItemSchema removed

const shipmentSchema = new Schema({
  shipmentId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    // Consider a pre-save hook or a separate service to generate this if needed
    // For now, assume it's provided or generated client-side/controller-side
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'assigned', 'in-transit', 'delayed', 'delivered', 'cancelled', 'on-hold'],
    default: 'pending'
  },
  // origin field removed
  destination: {
    type: addressSchema,
    required: true
  },
  deliveryDate: { // Renamed from pickupDate
    type: Date,
    required: true
  },
  estimatedDeliveryDate: { // This field might become redundant or be used for a different purpose
    type: Date
  },
  actualPickupDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  driver: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Assumes your User model is named 'User'
    // Validate that the user has the 'driver' role if assigned
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required for a shipment.']
  },
  // items field removed
  // totalWeight field removed
  // totalVolume field removed
  freightCost: { type: Number },
  truckNumber: { type: String, required: true },
  commissionCalculatedDate: { type: Date },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  trackingHistory: [{
    timestamp: { type: Date, default: Date.now },
    location: String, // Optional, could be city/state or GPS
    status: String, // e.g., "Picked Up", "Arrived at Hub", "Out for Delivery"
    notes: String
  }],
  notes: {
    type: String,
    trim: true
  },
  createdBy: { // User who created this shipment record
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: { // User who last updated this shipment record
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for performance
shipmentSchema.index({ shipmentId: 1 });
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ driver: 1 });
shipmentSchema.index({ deliveryDate: -1 }); // Updated index
shipmentSchema.index({ 'customer.name': 1 });


// TODO: Consider pre-save hook for validating driver role if a driver is assigned.
// Removed TODO for totalWeight/totalVolume calculation

module.exports = mongoose.model('Shipment', shipmentSchema);