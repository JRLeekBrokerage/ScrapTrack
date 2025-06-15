const mongoose = require('mongoose');

// Customer Schema
const customerSchema = new mongoose.Schema({
  // Basic Information
  companyName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  customerCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true
  },
  
  // Contact Information
  primaryContact: {
    name: {
      type: String,
      required: true
    },
    title: String,
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      trim: true
    },
    mobile: String
  },
  
  // Additional Contacts
  additionalContacts: [{
    name: String,
    title: String,
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: String,
    mobile: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Billing Address
  billingAddress: {
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
    },
    country: {
      type: String,
      default: 'USA'
    }
  },
  
  // Shipping Addresses (can have multiple)
  shippingAddresses: [{
    name: String,
    street1: String,
    street2: String,
    city: String,
    state: {
      type: String,
      uppercase: true,
      maxlength: 2
    },
    zipCode: String,
    country: {
      type: String,
      default: 'USA'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  
  // Financial Information
  paymentTerms: {
    type: String,
    default: 'Due Upon Receipt',
    enum: ['Due Upon Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Custom']
  },
  customPaymentTerms: String,
  creditLimit: {
    type: Number,
    default: 0
  },
  taxExempt: {
    type: Boolean,
    default: false
  },
  taxExemptNumber: String,
  defaultFuelSurchargeRate: {
    type: Number,
    default: 0.35,
    min: 0,
    max: 1
  },
  
  // Business Information
  businessType: {
    type: String,
    enum: ['Corporation', 'LLC', 'Partnership', 'Sole Proprietorship', 'Other']
  },
  industry: String,
  website: String,
  federalTaxId: String,
  
  // Relationship Information
  customerSince: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'prospect'],
    default: 'active'
  },
  rating: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'F'],
    default: 'B'
  },
  
  // Statistics
  totalInvoices: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  outstandingBalance: {
    type: Number,
    default: 0
  },
  lastInvoiceDate: Date,
  lastPaymentDate: Date,
  
  // Notes and Tags
  notes: String,
  tags: [String],
  
  // Internal flags
  isPreferred: {
    type: Boolean,
    default: false
  },
  requiresPO: {
    type: Boolean,
    default: false
  },
  autoSendInvoices: {
    type: Boolean,
    default: false
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
customerSchema.index({ companyName: 'text' });
customerSchema.index({ status: 1 });
customerSchema.index({ 'primaryContact.email': 1 });
customerSchema.index({ customerCode: 1 });

// Virtual for full billing address
customerSchema.virtual('fullBillingAddress').get(function() {
  const addr = this.billingAddress;
  return `${addr.street1}${addr.street2 ? ', ' + addr.street2 : ''}, ${addr.city}, ${addr.state} ${addr.zipCode}`;
});

// Virtual for primary contact full info
customerSchema.virtual('primaryContactInfo').get(function() {
  const contact = this.primaryContact;
  return `${contact.name} - ${contact.email || ''} - ${contact.phone || ''}`;
});

// Pre-save middleware to generate customer code if not provided
customerSchema.pre('save', async function(next) {
  if (!this.customerCode && this.isNew) {
    // Generate customer code from company name
    const code = this.companyName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 3);
    
    // Find similar codes and append number if needed
    const similar = await this.constructor.find({ 
      customerCode: new RegExp(`^${code}`) 
    }).sort({ customerCode: -1 }).limit(1);
    
    if (similar.length > 0) {
      const lastNum = parseInt(similar[0].customerCode.replace(code, '')) || 0;
      this.customerCode = code + (lastNum + 1);
    } else {
      this.customerCode = code + '1';
    }
  }
  
  next();
});

// Method to update statistics
customerSchema.methods.updateStatistics = async function() {
  const Invoice = mongoose.model('Invoice');
  
  const stats = await Invoice.aggregate([
    { $match: { customer: this._id } },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: '$invoiceTotal' },
        outstandingBalance: {
          $sum: {
            $cond: [
              { $ne: ['$paymentStatus', 'paid'] },
              { $subtract: ['$invoiceTotal', '$paidAmount'] },
              0
            ]
          }
        },
        lastInvoiceDate: { $max: '$invoiceDate' }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.totalInvoices = stats[0].totalInvoices;
    this.totalRevenue = stats[0].totalRevenue;
    this.outstandingBalance = stats[0].outstandingBalance;
    this.lastInvoiceDate = stats[0].lastInvoiceDate;
  }
  
  return this.save();
};

// Method to get default shipping address
customerSchema.methods.getDefaultShippingAddress = function() {
  const defaultAddr = this.shippingAddresses.find(addr => addr.isDefault);
  return defaultAddr || this.shippingAddresses[0] || this.billingAddress;
};

// Static method to find active customers
customerSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ companyName: 1 });
};

// Static method to find customers with outstanding balance
customerSchema.statics.findWithBalance = function() {
  return this.find({ outstandingBalance: { $gt: 0 } }).sort({ outstandingBalance: -1 });
};

module.exports = mongoose.model('Customer', customerSchema);
