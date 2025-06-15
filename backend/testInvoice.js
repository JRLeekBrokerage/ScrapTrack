require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('./src/models/Invoice');
const Customer = require('./src/models/Customer');
const Driver = require('./src/models/Driver');
const User = require('./src/models/User');

async function testInvoiceCreation() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scraptrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get test data
    const adminUser = await User.findOne({ username: 'admin' });
    const customer = await Customer.findOne({ companyName: 'Union Iron and Metal' });
    const driver1 = await Driver.findOne({ employeeId: 'DRV0001' });
    const driver2 = await Driver.findOne({ employeeId: 'DRV0002' });

    if (!adminUser || !customer || !driver1 || !driver2) {
      console.error('Required test data not found. Please run seedDatabase.js first.');
      process.exit(1);
    }

    // Create a test invoice
    const invoiceNumber = await Invoice.generateInvoiceNumber();
    
    const testInvoice = new Invoice({
      invoiceNumber,
      customer: customer._id,
      billTo: customer.companyName,
      projectDescription: 'Scrap metal delivery - June 2025',
      lineItems: [
        {
          date: new Date('2025-06-11'),
          shippingNumber: '60232',
          destination: 'Cle/Cle',
          driver: driver1._id,
          driverName: driver1.fullName,
          truckNumber: driver1.truckNumber,
          price: 85.50,
          weight: 24500
        },
        {
          date: new Date('2025-06-11'),
          shippingNumber: '60233',
          destination: 'Akron/Canton',
          driver: driver2._id,
          driverName: driver2.fullName,
          truckNumber: driver2.truckNumber,
          price: 92.00,
          weight: 18750
        },
        {
          date: new Date('2025-06-12'),
          shippingNumber: '60234',
          destination: 'Youngstown',
          driver: driver1._id,
          driverName: driver1.fullName,
          truckNumber: driver1.truckNumber,
          price: 88.25,
          weight: 21300
        }
      ],
      fuelSurchargeRate: customer.defaultFuelSurchargeRate,
      deposit: 0,
      paymentTerms: customer.paymentTerms,
      notes: 'Test invoice created via script',
      createdBy: adminUser._id
    });

    await testInvoice.save();

    // Populate the invoice for display
    await testInvoice.populate('customer', 'companyName');
    await testInvoice.populate('lineItems.driver', 'fullName employeeId');

    console.log('\n✅ Test invoice created successfully!\n');
    console.log('Invoice Details:');
    console.log('================');
    console.log(`Invoice Number: ${testInvoice.invoiceNumber}`);
    console.log(`Customer: ${testInvoice.customer.companyName}`);
    console.log(`Invoice Date: ${testInvoice.invoiceDate.toLocaleDateString()}`);
    console.log(`Payment Terms: ${testInvoice.paymentTerms}`);
    console.log('\nLine Items:');
    console.log('-----------');
    
    testInvoice.lineItems.forEach((item, index) => {
      console.log(`${index + 1}. Date: ${item.date.toLocaleDateString()}`);
      console.log(`   Shipping #: ${item.shippingNumber}`);
      console.log(`   Destination: ${item.destination}`);
      console.log(`   Driver: ${item.driverName}`);
      console.log(`   Truck: ${item.truckNumber}`);
      console.log(`   Price: $${item.price.toFixed(2)}/ton`);
      console.log(`   Weight: ${item.weight.toLocaleString()} lbs`);
      console.log(`   Amount: $${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log('');
    });

    console.log('Financial Summary:');
    console.log('------------------');
    console.log(`Subtotal: $${testInvoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Fuel Surcharge (${(testInvoice.fuelSurchargeRate * 100).toFixed(0)}%): $${testInvoice.fuelSurcharge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Deposit: $${testInvoice.deposit.toFixed(2)}`);
    console.log(`Invoice Total: $${testInvoice.invoiceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`\nTotal Items: ${testInvoice.totalItems}`);

    // Update customer statistics
    await customer.updateStatistics();
    console.log('\n✅ Customer statistics updated');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test invoice:', error);
    process.exit(1);
  }
}

testInvoiceCreation();
