const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const invoiceSchema = new Schema({
  invoiceNumber: { // Auto-generated or manually entered
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  customer: { // Renamed from billTo for consistency, now references Customer model
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required for an invoice.']
  },
  // Original billTo fields (name, contactEmail) will now come from populating the customer ref
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  shipments: [{ // Array of shipments included in this invoice
    type: Schema.Types.ObjectId,
    ref: 'Shipment',
    required: true
  }],
  subTotal: { type: Number, required: true, default: 0 }, // Sum of freightCost from all included shipments
  fuelSurchargeRate: { type: Number, default: 0.0, min: 0 }, // e.g., 0.05 for 5%
  fuelSurchargeAmount: { type: Number, default: 0.0, min: 0 },
  depositAmount: { type: Number, default: 0.0, min: 0 },
  totalAmount: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'partially-paid', 'overdue', 'void'],
    default: 'draft'
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  // TODO: Consider adding paymentHistory: [{ date: Date, amount: Number, method: String, reference: String }]
}, { timestamps: true });

invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ customer: 1 }); // Index on the customer reference
invoiceSchema.index({ issueDate: -1 });

// Pre-save hook to calculate totals might be useful
// Note: This is a simplified calculation. Actual calculation of subTotal (summing from shipments)
// and other dependent fields should ideally happen in a controller or service layer
// before saving, to ensure atomicity and access to related documents.
// However, fuelSurchargeAmount and totalAmount can be derived here if subTotal is set.
invoiceSchema.pre('save', function(next) {
  if (this.isModified('subTotal') || this.isModified('fuelSurchargeRate') || this.isModified('depositAmount')) {
    this.fuelSurchargeAmount = (this.subTotal || 0) * (this.fuelSurchargeRate || 0);
    this.totalAmount = ((this.subTotal || 0) + (this.fuelSurchargeAmount || 0)) - (this.depositAmount || 0);
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);