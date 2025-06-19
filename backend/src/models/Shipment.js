const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'USA' }
}, { _id: false });

const shipmentItemSchema = new Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  weight: { type: Number }, // Optional, in a consistent unit (e.g., lbs or kg)
  dimensions: { // Optional
    length: Number,
    width: Number,
    height: Number,
    unit: { type: String, enum: ['in', 'cm'], default: 'in' }
  }
}, { _id: false });

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
  origin: {
    type: addressSchema,
    required: true
  },
  destination: {
    type: addressSchema,
    required: true
  },
  pickupDate: { // Scheduled pickup
    type: Date,
    required: true
  },
  estimatedDeliveryDate: {
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
  customer: { // For simplicity, a string. Could be a ref to a Customer model later.
    name: { type: String, required: true },
    contactEmail: { type: String },
    contactPhone: { type: String }
  },
  items: [shipmentItemSchema],
  totalWeight: { type: Number }, // Optional, could be calculated
  totalVolume: { type: Number }, // Optional, could be calculated
  freightCost: { type: Number },
  truckNumber: { type: String },
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
shipmentSchema.index({ pickupDate: -1 });
shipmentSchema.index({ 'customer.name': 1 });


// TODO: Consider pre-save hook for validating driver role if a driver is assigned.
// TODO: Consider pre-save hook for calculating totalWeight or totalVolume if items have individual weights/volumes.

module.exports = mongoose.model('Shipment', shipmentSchema);