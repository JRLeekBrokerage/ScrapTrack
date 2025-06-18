const mongoose = require('mongoose');

// Invoice Schema
const invoiceSchema = new mongoose.Schema({
  // Invoice Header
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Customer Information
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  billTo: {
    type: String,
    required: true
  },
  projectDescription: {
    type: String,
    default: ''
  },
  
  // Line Items
  lineItems: [{
    date: {
      type: Date,
      required: true
    },
    shippingNumber: {
      type: String,
      required: true
    },
    destination: {
      type: String,
      required: true
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver'
    },
    driverName: {
      type: String,
      required: true
    },
    truckNumber: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    weight: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      default: 0
    }
  }],
  
  // Financial Summary
  subtotal: {
    type: Number,
    required: true,
    default: 0
  },
  fuelSurchargeRate: {
    type: Number,
    default: 0.35, // 35%
    min: 0,
    max: 1
  },
  fuelSurcharge: {
    type: Number,
    required: true,
    default: 0
  },
  deposit: {
    type: Number,
    default: 0
  },
  invoiceTotal: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Payment Information
  paymentTerms: {
    type: String,
    default: 'Due Upon Receipt'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentDate: Date,
  
  // Metadata
  notes: String,
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'paid', 'cancelled'],
    default: 'draft'
  },
  sentDate: Date,
  viewedDate: Date,
  
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

// Indexes for performance
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ customer: 1, invoiceDate: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ 'lineItems.shippingNumber': 1 });

// Virtual for total line items count
invoiceSchema.virtual('totalItems').get(function() {
  return this.lineItems.filter(item => item.truckNumber).length;
});

// Pre-save middleware to calculate amounts
invoiceSchema.pre('save', function(next) {
  // Calculate line item amounts
  this.lineItems.forEach(item => {
    // Convert pounds to tons (2000 lbs = 1 ton) for price calculation
    const tons = item.weight / 2000;
    item.amount = item.price * tons;
  });
  
  // Calculate subtotal
  this.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  
  // Calculate fuel surcharge
  this.fuelSurcharge = this.subtotal * this.fuelSurchargeRate;
  
  // Calculate invoice total
  this.invoiceTotal = (this.subtotal + this.fuelSurcharge) - this.deposit;
  
  // Update payment status
  if (this.paidAmount >= this.invoiceTotal) {
    this.paymentStatus = 'paid';
  } else if (this.paidAmount > 0) {
    this.paymentStatus = 'partial';
  }
  
  next();
});

// Method to generate next invoice number
invoiceSchema.statics.generateInvoiceNumber = async function() {
  const lastInvoice = await this.findOne({}, {}, { sort: { 'invoiceNumber': -1 } });
  if (lastInvoice && lastInvoice.invoiceNumber) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber);
    return (lastNumber + 1).toString();
  }
  return '23754'; // Starting number based on the example
};

// Method to add line item
invoiceSchema.methods.addLineItem = function(lineItem) {
  this.lineItems.push(lineItem);
  return this.save();
};

// Method to update payment
invoiceSchema.methods.recordPayment = function(amount, paymentDate = new Date()) {
  this.paidAmount += amount;
  this.paymentDate = paymentDate;
  
  if (this.paidAmount >= this.invoiceTotal) {
    this.paymentStatus = 'paid';
    this.status = 'paid';
  } else {
    this.paymentStatus = 'partial';
  }
  
  return this.save();
};

// Method to mark as sent
invoiceSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentDate = new Date();
  return this.save();
};

// Method to mark as viewed
invoiceSchema.methods.markAsViewed = function() {
  if (this.status === 'sent') {
    this.status = 'viewed';
    this.viewedDate = new Date();
    return this.save();
  }
  return this;
};

module.exports = mongoose.model('Invoice', invoiceSchema);
