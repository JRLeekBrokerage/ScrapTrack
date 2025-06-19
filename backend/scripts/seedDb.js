require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') }); // Load .env variables
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For hashing driver passwords
const User = require('../src/models/User');
const Shipment = require('../src/models/Shipment');
const Invoice = require('../src/models/Invoice');
const Customer = require('../src/models/Customer'); // Import Customer model
const { MongoMemoryServer } = require('mongodb-memory-server'); // For in-memory DB during dev seeding

// --- Configuration ---
const CLEAR_EXISTING_DATA = true; // Set to false to append data instead of clearing
let mongod; // To hold the in-memory server instance for seeding

// --- Sample Data ---

const sampleDriversData = [
  {
    username: 'johndriver',
    email: 'john.driver@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Driver',
    role: 'driver',
    phone: '5550101001', // Updated phone format
    commissionRate: 0.15,
    permissions: [
        { module: 'freight', actions: ['read', 'update'] },
        { module: 'drivers', actions: ['read'] },
        { module: 'invoicing', actions: ['read'] } // Added invoicing read permission
    ]
  },
  {
    username: 'janedriver',
    email: 'jane.driver@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Driveress',
    role: 'driver',
    phone: '5550102002', // Updated phone format
    commissionRate: 0.12,
    permissions: [
        { module: 'freight', actions: ['read', 'update'] },
        { module: 'drivers', actions: ['read'] },
        { module: 'invoicing', actions: ['read'] } // Added invoicing read permission
    ]
  },
  {
    username: 'bobtrucker',
    email: 'bob.trucker@example.com',
    password: 'password123',
    firstName: 'Bob',
    lastName: 'Trucker',
    role: 'driver',
    phone: '5550103003', // Updated phone format
    commissionRate: 0.10,
    permissions: [
        { module: 'freight', actions: ['read', 'update'] },
        { module: 'drivers', actions: ['read'] },
        { module: 'invoicing', actions: ['read'] } // Added invoicing read permission
    ]
  }
];

const sampleCustomersData = [
  { name: 'Alpha Corp', contactEmail: 'contact@alpha.com', contactPhone: '555-1111', primaryAddress: { street: '1 Alpha Way', city: 'Alphaville', state: 'CA', zipCode: '90210'} },
  { name: 'Beta LLC', contactEmail: 'info@beta.llc', contactPhone: '555-2222', primaryAddress: { street: '2 Beta Drive', city: 'Betatown', state: 'AZ', zipCode: '85002'} },
  { name: 'Gamma Inc', contactEmail: 'contact@gamma.com', contactPhone: '555-3333', primaryAddress: { street: '3 Gamma Circle', city: 'Gammaburg', state: 'NV', zipCode: '89003'} },
  { name: 'Delta Co', contactEmail: 'contact@delta.co', contactPhone: '555-4444', primaryAddress: { street: '4 Delta Place', city: 'Deltaport', state: 'TX', zipCode: '75004'} },
  { name: 'Epsilon Ltd', contactEmail: 'info@epsilon.ltd', contactPhone: '555-5555', primaryAddress: { street: '5 Epsilon St', city: 'Epsilon City', state: 'FL', zipCode: '33005'} },
];

const sampleShipmentsData = (driverIds, customerIds) => [
  // Shipments for John Driver
  {
    shipmentId: 'SHJ0001', status: 'delivered', truckNumber: 'T-101',
    origin: { street: '123 Origin St', city: 'Originville', state: 'CA', zipCode: '90001', country: 'USA' },
    destination: { street: '456 Destination Ave', city: 'Destination City', state: 'NV', zipCode: '89001', country: 'USA' },
    pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // Delivered 8 days ago
    driver: driverIds.john, customer: customerIds.alpha,
    items: [{ description: 'Scrap Metal A', quantity: 1, weight: 35000 }], totalWeight: 35000, // < 40k
    freightCost: 280.00,
  },
  {
    shipmentId: 'SHJ0002', status: 'delivered', truckNumber: 'T-101',
    origin: { street: '124 Origin St', city: 'Originville', state: 'CA', zipCode: '90001', country: 'USA' },
    destination: { street: '457 Destination Ave', city: 'Destination City', state: 'NV', zipCode: '89001', country: 'USA' },
    pickupDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Delivered 5 days ago
    driver: driverIds.john, customer: customerIds.alpha,
    items: [{ description: 'Scrap Metal B', quantity: 1, weight: 45000 }], totalWeight: 45000, // > 40k
    freightCost: 360.00,
  },
  {
    shipmentId: 'SHJ0003', status: 'delivered', truckNumber: 'T-102',
    origin: { street: '125 Origin St', city: 'Originville', state: 'CA', zipCode: '90001', country: 'USA' },
    destination: { street: '458 Destination Ave', city: 'Destination City', state: 'NV', zipCode: '89001', country: 'USA' },
    pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Delivered 1 day ago
    driver: driverIds.john, customer: customerIds.gamma,
    items: [{ description: 'Scrap Metal C', quantity: 1, weight: 25000 }], totalWeight: 25000, // < 40k
    freightCost: 200.00,
  },

  // Shipments for Jane Driveress
  {
    shipmentId: 'SHJA001', status: 'delivered', truckNumber: 'T-201',
    origin: { street: '789 Source Rd', city: 'Sourceburg', state: 'AZ', zipCode: '85001', country: 'USA' },
    destination: { street: '101 Target Ln', city: 'Targetown', state: 'TX', zipCode: '75001', country: 'USA' },
    pickupDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // Delivered 6 days ago
    driver: driverIds.jane, customer: customerIds.beta,
    items: [{ description: 'Industrial Parts', quantity: 1, weight: 52000 }], totalWeight: 52000, // > 40k
    freightCost: 416.00,
  },
  {
    shipmentId: 'SHJA002', status: 'delivered', truckNumber: 'T-201',
    origin: { street: '790 Source Rd', city: 'Sourceburg', state: 'AZ', zipCode: '85001', country: 'USA' },
    destination: { street: '102 Target Ln', city: 'Targetown', state: 'TX', zipCode: '75001', country: 'USA' },
    pickupDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Delivered 2 days ago
    driver: driverIds.jane, customer: customerIds.beta,
    items: [{ description: 'Components', quantity: 1, weight: 15000 }], totalWeight: 15000, // < 40k
    freightCost: 120.00,
  },

  // Shipments for Bob Trucker
  {
    shipmentId: 'SHB0001', status: 'delivered', truckNumber: 'T-301',
    origin: { street: '321 Start St', city: 'Startville', state: 'FL', zipCode: '33001', country: 'USA' },
    destination: { street: '654 End Ave', city: 'End City', state: 'GA', zipCode: '30001', country: 'USA' },
    pickupDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Delivered 10 days ago
    driver: driverIds.bob, customer: customerIds.delta,
    items: [{ description: 'Raw Materials', quantity: 1, weight: 60000 }], totalWeight: 60000, // > 40k
    freightCost: 480.00,
  },
  {
    shipmentId: 'SHB0002', status: 'in-transit', truckNumber: 'T-302',
    origin: { street: '322 Start St', city: 'Startville', state: 'FL', zipCode: '33001', country: 'USA' },
    destination: { street: '655 End Ave', city: 'End City', state: 'GA', zipCode: '30001', country: 'USA' },
    pickupDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.epsilon,
    items: [{ description: 'Finished Goods', quantity: 1, weight: 30000 }], totalWeight: 30000,
    freightCost: 240.00,
  },
  {
    shipmentId: 'SHB0003', status: 'pending', truckNumber: 'T-301',
    origin: { street: '323 Start St', city: 'Startville', state: 'FL', zipCode: '33001', country: 'USA' },
    destination: { street: '656 End Ave', city: 'End City', state: 'GA', zipCode: '30001', country: 'USA' },
    pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.delta,
    items: [{ description: 'Return Load', quantity: 1, weight: 10000 }], totalWeight: 10000,
    freightCost: 80.00,
  }
];

const sampleInvoicesData = (shipmentMap, customerMap, createdById) => [ // Added customerMap
  {
    invoiceNumber: 'INV2025-001',
    customer: shipmentMap['SHJ0001'].customer, // This is now a customerId from the shipment
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    shipments: [shipmentMap['SHJ0001']._id],
    subTotal: shipmentMap['SHJ0001'].freightCost,
    fuelSurchargeRate: 0.05,
    status: 'draft',
    createdBy: createdById,
    notes: `Invoice for shipment ${shipmentMap['SHJ0001'].shipmentId}`
  },
  {
    invoiceNumber: 'INV2025-002',
    customer: shipmentMap['SHJA001'].customer,
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    shipments: [shipmentMap['SHJA001']._id],
    subTotal: shipmentMap['SHJA001'].freightCost,
    fuelSurchargeRate: 0.07,
    status: 'sent',
    createdBy: createdById,
    notes: `Invoice for shipment ${shipmentMap['SHJA001'].shipmentId}`
  },
  {
    invoiceNumber: 'INV2025-003',
    customer: shipmentMap['SHB0001'].customer,
    issueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
    shipments: [shipmentMap['SHB0001']._id],
    subTotal: shipmentMap['SHB0001'].freightCost,
    status: 'paid',
    createdBy: createdById,
    notes: `Invoice for shipment ${shipmentMap['SHB0001'].shipmentId} (already paid)`
  }
];


// --- Seeding Logic ---
// This function now assumes mongoose is already connected to the desired database.
const performSeed = async () => {
  try {
    if (CLEAR_EXISTING_DATA) {
      console.log('Clearing existing data for seed...');
      // Clear only data relevant to this seed to avoid wiping unrelated collections
      await User.deleteMany({ username: { $in: sampleDriversData.map(d => d.username) } });
      // Update Shipment and Invoice clearing to be more robust or clear all if it's purely for seeding
      await Shipment.deleteMany({}); // Clearing all shipments for fresh seed
      await Invoice.deleteMany({});  // Clearing all invoices for fresh seed
      await Customer.deleteMany({}); // Clearing all customers for fresh seed
      console.log('Existing sample data cleared.');
    }

    // 1. Create Customers
    console.log('Creating sample customers...');
    const createdCustomers = await Customer.insertMany(sampleCustomersData.map(c => ({...c, createdBy: null}))); // Assuming admin/system creates customers initially
    console.log(`${createdCustomers.length} customers created.`);
    const customerIds = {
        alpha: createdCustomers.find(c => c.name === 'Alpha Corp')._id,
        beta: createdCustomers.find(c => c.name === 'Beta LLC')._id,
        gamma: createdCustomers.find(c => c.name === 'Gamma Inc')._id,
        delta: createdCustomers.find(c => c.name === 'Delta Co')._id,
        epsilon: createdCustomers.find(c => c.name === 'Epsilon Ltd')._id,
    };

    // 2. Create Drivers
    console.log('Hashing sample driver passwords...');
    const processedDriversData = await Promise.all(sampleDriversData.map(async (driver) => {
      const salt = await bcrypt.genSalt(10); // Or 12, matching your pre-save hook if desired
      const hashedPassword = await bcrypt.hash(driver.password, salt);
      return { ...driver, password: hashedPassword };
    }));

    console.log('Creating sample drivers with hashed passwords...');
    const createdDrivers = await User.insertMany(processedDriversData);
    console.log(`${createdDrivers.length} drivers created.`);
    const driverIds = {
        john: createdDrivers.find(d => d.username === 'johndriver')._id,
        jane: createdDrivers.find(d => d.username === 'janedriver')._id,
        bob: createdDrivers.find(d => d.username === 'bobtrucker')._id,
    };
    // For 'createdBy' fields, you might want to fetch an existing admin/system user
    // or create one if it doesn't exist. For simplicity, using the first driver's ID.
    const anExistingUserId = createdDrivers.length > 0 ? createdDrivers[0]._id : null; // Handle case of no drivers

    // 3. Create Shipments (now needs customerIds)
    console.log('Creating sample shipments...');
    const shipmentsToCreate = sampleShipmentsData(driverIds, customerIds).map(s => ({...s, createdBy: anExistingUserId }));
    const createdShipments = await Shipment.insertMany(shipmentsToCreate);
    console.log(`${createdShipments.length} shipments created.`);
    
    const shipmentMap = {}; // To map old shipmentId structure if needed by invoices, or pass full objects
    createdShipments.forEach(s => shipmentMap[s.shipmentId] = s);


    // 4. Create Invoices (now needs customerMap if we want to preserve billTo.name logic from old invoice data)
    // For simplicity, sampleInvoicesData now directly uses customerId from the shipment.
    console.log('Creating sample invoices...');
    const customerObjects = {}; // For easy lookup if needed by sampleInvoicesData
    createdCustomers.forEach(c => customerObjects[c._id.toString()] = c);

    const invoicesToCreate = sampleInvoicesData(shipmentMap, customerObjects, anExistingUserId);
    const createdInvoices = [];
    for (const invData of invoicesToCreate) {
        const invoice = new Invoice(invData);
        await invoice.save();
        createdInvoices.push(invoice);
    }
    console.log(`${createdInvoices.length} invoices created.`);

    // Verify invoices in DB immediately after saving in seed
    const invoicesInDbAfterSeed = await Invoice.find({});
    console.log(`[performSeed] Verification: Found ${invoicesInDbAfterSeed.length} invoices in DB immediately after saving.`);
    // invoicesInDbAfterSeed.forEach(inv => console.log(`[performSeed] Invoice in DB: ${inv.invoiceNumber}, ID: ${inv._id}`));


    // Log the IDs of the created invoices
    if (createdInvoices.length > 0) {
      console.log("--- Created Invoice IDs ---");
      createdInvoices.forEach(inv => {
        console.log(`Invoice Number: ${inv.invoiceNumber}, ID: ${inv._id}`);
      });
      console.log("--------------------------");
    }

    console.log('Database seeding completed successfully!');
    return true;

  } catch (error) {
    console.error('Error during seeding process:', error);
    return false;
  }
};

// If run directly (node scripts/seedDb.js), connect and seed.
// This part is now mainly for testing the seed script against a persistent DB if needed.
if (require.main === module) {
  console.log('Running seedDb.js directly. This will attempt to connect to MongoDB based on .env settings.');
  
  let mongodInstance; // To hold in-memory server if used by direct run

  const connectAndSeed = async () => {
    let mongoURI_direct_run;

    if (process.env.MONGODB_URI) {
        mongoURI_direct_run = process.env.MONGODB_URI;
        console.log(`Direct run: Using provided MONGODB_URI: ${mongoURI_direct_run}`);
    } else if (process.env.NODE_ENV === 'production') {
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = process.env.DB_PORT || '27017';
        const dbName = process.env.DB_NAME || 'leekbrokerage_db_direct_seed';
        mongoURI_direct_run = `mongodb://${dbHost}:${dbPort}/${dbName}`;
        console.log(`Direct run: Production mode, using persistent DB: ${mongoURI_direct_run}`);
    } else {
        console.log('Direct run: Defaulting to in-memory MongoDB for standalone script execution.');
        mongodInstance = await MongoMemoryServer.create();
        mongoURI_direct_run = mongodInstance.getUri();
    }

    try {
      await mongoose.connect(mongoURI_direct_run, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('Direct run: MongoDB connected.');
      await performSeed();
    } catch (err) {
      console.error('Direct run: MongoDB connection or seeding error:', err);
    } finally {
      await mongoose.disconnect();
      console.log('Direct run: MongoDB disconnected.');
      if (mongodInstance) {
        await mongodInstance.stop();
        console.log('Direct run: In-memory MongoDB server stopped.');
      }
      process.exit();
    }
  };
  connectAndSeed();
}

module.exports = { performSeed }; // Export the seeding function