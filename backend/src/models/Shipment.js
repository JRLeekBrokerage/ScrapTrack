const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({
  street: { type: String }, // No longer required
  city: { type: String, required: true },
  state: { type: String }, // No longer required
  zipCode: { type: String }, // No longer required
  country: { type: String, default: 'USA' } // No longer required, but has default
}, { _id: false });

// shipmentItemSchema removed

const shipmentSchema = new Schema({
  shippingNumber: { // Renamed from shipmentId
    type: String,
    required: true,
    // unique: true, // Temporarily removed, can be re-added or handled at controller/service layer if strict DB enforcement is needed
    trim: true,
  },
  // Mongoose _id will serve as the internal unique ID for API calls and references
  status: {
    type: String,
    required: true,
    enum: ['pending', 'assigned', 'in-transit', 'delayed', 'delivered', 'cancelled', 'on-hold'],
    default: 'pending'
  },
  origin: { // Added origin field back
    type: addressSchema,
    required: true
  },
  destination: {
    type: addressSchema,
    required: true
  },
  deliveryDate: { // Renamed from pickupDate
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
    ref: 'User', 
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required for a shipment.']
  },
  // items field removed
  // totalVolume field removed
  weight: { type: Number }, // Retained as per previous changes (distinct from totalWeight which was also removed)
  rate: { type: Number },   
  freightCost: { type: Number }, 
  truckNumber: { type: String, required: true },
  commissionCalculatedDate: { type: Date },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
  trackingHistory: [{
    timestamp: { type: Date, default: Date.now },
    location: String, 
    status: String, 
    notes: String
  }],
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
}, {
  timestamps: true 
});

// Indexes for performance
shipmentSchema.index({ shippingNumber: 1 }); // Index for the new user-facing ID
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ driver: 1 });
shipmentSchema.index({ deliveryDate: -1 }); 
shipmentSchema.index({ 'customer.name': 1 });


// TODO: Consider pre-save hook for validating driver role if a driver is assigned.

// Pre-save hook to calculate freightCost if rate and weight are present
shipmentSchema.pre('save', function(next) {
  if (this.isModified('rate') || this.isModified('weight') || (this.isNew && this.rate != null && this.weight != null)) {
    if (this.rate != null && this.weight != null) {
      this.freightCost = parseFloat((this.rate * this.weight).toFixed(2));
    }
  }
  next();
});

module.exports = mongoose.model('Shipment', shipmentSchema);