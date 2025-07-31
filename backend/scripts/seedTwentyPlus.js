require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver');
const Shipment = require('../src/models/Shipment');
const Invoice = require('../src/models/Invoice');
const Customer = require('../src/models/Customer');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { performSeed } = require('./seedDb'); // Import the original seeder

let mongod;

const performCustomSeed = async () => {
  try {
    // 1. Run the original seed script first.
    // It will handle clearing the data.
    console.log('Running original database seed...');
    await performSeed();
    console.log('Original database seed completed.');

    // 2. Get existing data to create the large invoice
    const adminUser = await User.findOne({ role: 'admin' });
    const customer = await Customer.findOne({ name: 'Alpha Corp' });
    const driver = await Driver.findOne({ firstName: 'John' });

    if (!adminUser || !customer || !driver) {
      console.error('Could not find necessary data from original seed to create large invoice. Aborting.');
      return false;
    }

    // 3. Create 20 Shipments for Alpha Corp
    console.log('Creating 20 shipments for Alpha Corp...');
    const shipments = [];
    for (let i = 0; i < 20; i++) {
      const shipmentData = {
        shippingNumber: `SH-ALPHA-${String(1001 + i).padStart(4, '0')}`,
        status: 'delivered',
        truckNumber: `T-ALPHA-${101 + (i % 5)}`,
        origin: { city: `Origin City ${i % 3}`, state: ['CA', 'AZ', 'NV'][i % 3] },
        destination: { street: `${i + 1} Delivery Ave`, city: `Destination City ${i % 5}`, state: ['GA', 'OH', 'PA', 'MI', 'IL'][i % 5], zipCode: `${91001 + i}` },
        deliveryDate: new Date(Date.now() - (i * 2) * 24 * 60 * 60 * 1000),
        actualPickupDate: new Date(Date.now() - ((i * 2) + 2) * 24 * 60 * 60 * 1000),
        actualDeliveryDate: new Date(Date.now() - (i * 2) * 24 * 60 * 60 * 1000),
        driver: driver._id,
        customer: customer._id,
        weight: 40000 + (i * 100),
        rate: 20 + (i * 0.5),
        createdBy: adminUser._id,
      };
      const shipment = new Shipment(shipmentData);
      await shipment.save();
      shipments.push(shipment);
    }
    console.log(`${shipments.length} shipments created for Alpha Corp.`);

    // 4. Create one Invoice with the first 10 Shipments
    console.log('Creating an invoice with 10 shipments...');
    const first10Shipments = shipments.slice(0, 10);
    const first10ShipmentIds = first10Shipments.map(s => s._id);
    const subTotal = first10Shipments.reduce((acc, s) => acc + s.freightCost, 0);

    const invoice = new Invoice({
      invoiceNumber: 'INV-ALPHA-001',
      customer: customer._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      shipments: first10ShipmentIds,
      subTotal: subTotal,
      fuelSurchargeRate: customer.fuelSurchargeRate,
      status: 'draft',
      createdBy: adminUser._id,
      notes: 'Invoice with 10 shipments.'
    });
    await invoice.save();
    console.log('Invoice with 10 shipments created successfully.');
    console.log(`Invoice Number: ${invoice.invoiceNumber}, ID: ${invoice._id}, Shipments Count: ${invoice.shipments.length}`);

    // Update the first 10 shipments with the invoiceId
    await Shipment.updateMany(
      { _id: { $in: first10ShipmentIds } },
      { $set: { invoiceId: invoice._id } }
    );


    console.log('Custom database seeding for bug reproduction completed successfully!');
    return true;

  } catch (error) {
    console.error('Error during custom seeding process:', error);
    return false;
  }
};

const connectAndSeed = async () => {
  let mongoURI;

  if (process.env.MONGODB_URI) {
      mongoURI = process.env.MONGODB_URI;
      console.log(`Using provided MONGODB_URI: ${mongoURI}`);
  } else {
      console.log('Development/Test mode, using in-memory MongoDB.');
      mongod = await MongoMemoryServer.create();
      mongoURI = mongod.getUri();
  }

  try {
    await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected.');
    await performCustomSeed();
  } catch (err) {
    console.error('MongoDB connection or seeding error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
    if (mongod) {
      await mongod.stop();
      console.log('In-memory MongoDB server stopped.');
    }
    process.exit();
  }
};

if (require.main === module) {
  connectAndSeed();
}

module.exports = { performCustomSeed };