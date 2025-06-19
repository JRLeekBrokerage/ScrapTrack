const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({ // Re-using a similar structure for consistency
  street: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
  country: { type: String, default: 'USA' }
}, { _id: false });

const customerSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required.'],
    trim: true,
    unique: true // Assuming customer names should be unique
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address for contact.']
  },
  contactPhone: {
    type: String,
    trim: true
  },
  primaryAddress: addressSchema, // Example of an embedded address
  // You could also have an array of addresses: billingAddress: addressSchema, shippingAddress: addressSchema, etc.
  notes: {
    type: String,
    trim: true
  },
  isActive: { // To allow for deactivating customers instead of deleting
    type: Boolean,
    default: true
  },
  // Consider adding fields like 'accountNumber', 'paymentTerms', etc. later
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    // required: true // Make required if you always want to track who created it
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

customerSchema.index({ name: 1 });
customerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Customer', customerSchema);