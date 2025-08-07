require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); // Load .env variables
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Driver = require('../src/models/Driver'); // Import new Driver model
const Shipment = require('../src/models/Shipment');
const Invoice = require('../src/models/Invoice');
const Customer = require('../src/models/Customer');
const { MongoMemoryServer } = require('mongodb-memory-server');

// --- Configuration ---
const CLEAR_EXISTING_DATA = true; // Set to false to append data instead of clearing
let mongod; // To hold the in-memory server instance for seeding

// --- Sample Data ---

// Sample System Users (Admins, Dispatchers, etc.)
const sampleUsersData = [
  {
    username: 'adminuser',
    email: 'admin@leekbrokerage.com',
    password: 'passwordAdmin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin', // System user role
    phone: '5550000000',
    permissions: [ // Example full permissions for admin
       { module: 'freight', actions: ['create', 'read', 'update', 'delete', 'export'] },
       { module: 'invoicing', actions: ['create', 'read', 'update', 'delete', 'export'] },
       { module: 'reports', actions: ['create', 'read', 'update', 'delete', 'export'] },
       { module: 'users', actions: ['create', 'read', 'update', 'delete', 'export'] },
       { module: 'drivers', actions: ['create', 'read', 'update', 'delete', 'export'] }, // For managing new Driver entities
       { module: 'settings', actions: ['create', 'read', 'update', 'delete', 'export'] },
       { module: 'scrap', actions: ['create', 'read', 'update', 'delete', 'export'] }
    ]
  },
  {
    username: 'dispatchuser',
    email: 'dispatch@leekbrokerage.com',
    password: 'passwordDispatch123',
    firstName: 'Dispatch',
    lastName: 'Person',
    role: 'dispatcher', // System user role
    phone: '5550000001',
    permissions: [
       { module: 'freight', actions: ['create', 'read', 'update'] },
       { module: 'drivers', actions: ['read', 'update'] }, // Can view/update new Driver entities
       { module: 'invoicing', actions: ['read'] }
    ]
  }
];

// Sample Non-Logging-In Drivers
const sampleNewDriversData = [
    { firstName: 'John', lastName: 'Truckman', contactPhone: '555-0101', contactEmail: 'john.truckman@email.com', commissionRate: 0.25, isActive: true },
    { firstName: 'Jane', lastName: 'Hauler', contactPhone: '555-0102', contactEmail: 'jane.hauler@email.com', commissionRate: 0.22, isActive: true },
    { firstName: 'Robert', lastName: 'Wheels', contactPhone: '555-0103', contactEmail: 'bob.wheels@email.com', commissionRate: 0.20, isActive: true },
];

const sampleCustomersData = [
  { name: 'Alpha Corp', contactEmail: 'contact@alpha.com', contactPhone: '555-1111', primaryAddress: { street: '1 Alpha Way', city: 'Alphaville', state: 'CA', zipCode: '90210'} },
  { name: 'Beta LLC', contactEmail: 'info@beta.llc', contactPhone: '555-2222', primaryAddress: { street: '2 Beta Drive', city: 'Betatown', state: 'AZ', zipCode: '85002'} },
  { name: 'Gamma Inc', contactEmail: 'contact@gamma.com', contactPhone: '555-3333', primaryAddress: { street: '3 Gamma Circle', city: 'Gammaburg', state: 'NV', zipCode: '89003'} },
  { name: 'Delta Co', contactEmail: 'contact@delta.co', contactPhone: '555-4444', primaryAddress: { street: '4 Delta Place', city: 'Deltaport', state: 'TX', zipCode: '75004'} },
  { name: 'Epsilon Ltd', contactEmail: 'info@epsilon.ltd', contactPhone: '555-5555', primaryAddress: { street: '5 Epsilon St', city: 'Epsilon City', state: 'FL', zipCode: '33005'} },
];

const sampleShipmentsData = (driverIds, customerIds) => {
  const shipments = [];
  const statuses = ['delivered', 'in-transit', 'assigned', 'pending'];
  const weights = [35000, 45000, 25000, 52000, 15000, 60000, 30000, 10000, 22000, 33000, 41000, 38000, 47000, 12000, 28000, 31000, 55000, 19000, 25000, 32000, 42000, 36000, 15000, 29000, 34000, 58000, 21000, 27000, 39000, 43000];
  const customers = Object.values(customerIds);
  const drivers = Object.values(driverIds);

  for (let i = 0; i < 42; i++) {
    const randomRate = parseFloat((Math.random() * (50 - 5) + 5).toFixed(4));
    const weight = weights[i % weights.length];
    shipments.push({
      shippingNumber: `SH${String(1001 + i).padStart(4, '0')}`,
      status: statuses[i % statuses.length],
      truckNumber: `T-${101 + (i % 5)}`,
      origin: { city: `Origin ${i % 5}`, state: ['CA', 'AZ', 'NV', 'TX', 'FL'][i % 5] },
      destination: { street: `${i+1} Main St`, city: `Destination ${i % 10}`, state: ['GA', 'OH', 'PA', 'MI', 'IL'][i % 5], zipCode: `${90001 + i}` },
      deliveryDate: new Date(Date.now() - (i * 2) * 24 * 60 * 60 * 1000),
      actualPickupDate: new Date(Date.now() - ((i * 2) + 2) * 24 * 60 * 60 * 1000),
      actualDeliveryDate: new Date(Date.now() - (i * 2) * 24 * 60 * 60 * 1000),
      driver: drivers[i % drivers.length],
      customer: customers[i % customers.length],
      weight: weight,
      rate: randomRate,
      // freightCost is intentionally omitted to be calculated by the pre-save hook
    });
  }
  return shipments;
};

const sampleInvoicesData = (createdShipments, createdById) => {
  const invoices = [];
  const invoiceStatuses = ['draft', 'sent', 'paid', 'partially-paid', 'overdue', 'void'];
  let invoiceCounter = 1;

  const deliveredShipments = createdShipments.filter(s => s.status === 'delivered');

  for (let i = 0; i < deliveredShipments.length && invoices.length < 30; i++) {
    const shipment = deliveredShipments[i];
    if (!shipment.customer) {
        console.warn(`Shipment ${shipment.shippingNumber} is missing a customer. Skipping invoice creation.`);
        continue;
    }

    const issueDate = new Date(Date.now() - (i * 3) * 24 * 60 * 60 * 1000); 
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    let status = invoiceStatuses[i % invoiceStatuses.length];
    if ((status === 'paid' || status === 'void') && Math.random() < 0.6) { 
        status = (i % 3 === 0) ? 'sent' : 'draft'; 
    }
    if (status === 'overdue' && dueDate > new Date()) { 
        status = 'sent';
    }
    if (status === 'paid' && i % 5 !== 0) { 
        status = 'sent';
    }


    invoices.push({
      invoiceNumber: `INV2025-${String(invoiceCounter++).padStart(3, '0')}`,
      customer: shipment.customer, 
      issueDate: issueDate,
      dueDate: dueDate,
      shipments: [shipment._id],
      // Calculate subTotal based on the same logic as the Shipment pre-save hook
      // to ensure consistency during seeding.
      subTotal: parseFloat(((Math.max(shipment.weight, 40000) / 2000) * shipment.rate).toFixed(2)),
      fuelSurchargeRate: Math.random() * 0.1,
      status: status,
      createdBy: createdById,
      notes: `Invoice for shipment ${shipment.shippingNumber}. Notes for invoice #${invoiceCounter -1}.`
    });
  }
   if (invoices.length < 3 && deliveredShipments.length >= 3) {
        const baseShipments = [deliveredShipments[0], deliveredShipments[1], deliveredShipments[2]];
        if(baseShipments[0] && !invoices.find(inv => inv.shipments.includes(baseShipments[0]._id))) {
            invoices.push({
                invoiceNumber: `INV2025-${String(invoiceCounter++).padStart(3, '0')}`,
                customer: baseShipments[0].customer, issueDate: new Date(), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                shipments: [baseShipments[0]._id], subTotal: parseFloat(((Math.max(baseShipments[0].weight, 40000) / 2000) * baseShipments[0].rate).toFixed(2)), fuelSurchargeRate: 0.05, status: 'draft', createdBy: createdById, notes: `Fallback invoice for ${baseShipments[0].shippingNumber}`
            });
        }
        if(baseShipments[1] && !invoices.find(inv => inv.shipments.includes(baseShipments[1]._id))) {
             invoices.push({
                invoiceNumber: `INV2025-${String(invoiceCounter++).padStart(3, '0')}`,
                customer: baseShipments[1].customer, issueDate: new Date(), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                shipments: [baseShipments[1]._id], subTotal: parseFloat(((Math.max(baseShipments[1].weight, 40000) / 2000) * baseShipments[1].rate).toFixed(2)), fuelSurchargeRate: 0.07, status: 'sent', createdBy: createdById, notes: `Fallback invoice for ${baseShipments[1].shippingNumber}`
            });
        }
        if(baseShipments[2] && !invoices.find(inv => inv.shipments.includes(baseShipments[2]._id))) {
            invoices.push({
                invoiceNumber: `INV2025-${String(invoiceCounter++).padStart(3, '0')}`,
                customer: baseShipments[2].customer, issueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
                shipments: [baseShipments[2]._id], subTotal: parseFloat(((Math.max(baseShipments[2].weight, 40000) / 2000) * baseShipments[2].rate).toFixed(2)), status: 'paid', createdBy: createdById, notes: `Fallback invoice for ${baseShipments[2].shippingNumber}`
            });
        }
    }


  return invoices;
};


// --- Seeding Logic ---
// This function now assumes mongoose is already connected to the desired database.
const performSeed = async () => {
  try {
    if (CLEAR_EXISTING_DATA) {
      console.log('Clearing existing data for seed...');
      // Clear Users (system users)
      await User.deleteMany({ username: { $in: sampleUsersData.map(u => u.username) } });
      // Clear new Driver entities
      await Driver.deleteMany({});
      await Shipment.deleteMany({});
      await Invoice.deleteMany({});
      await Customer.deleteMany({});
      console.log('Existing sample data cleared.');
    }

    // 1. Create System Users (Admin, Dispatcher, etc.)
    console.log('Hashing sample user passwords...');
    const processedUsersData = await Promise.all(sampleUsersData.map(async (user) => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      return { ...user, password: hashedPassword };
    }));
    console.log('Creating sample system users...');
    const createdSystemUsers = await User.insertMany(processedUsersData);
    console.log(`${createdSystemUsers.length} system users created.`);
    const anAdminUserId = createdSystemUsers.find(u => u.role === 'admin')?._id;

    // 2. Create Customers
    console.log('Creating sample customers...');
    const customersWithFuelRate = sampleCustomersData.map(c => {
      const randomFuelRate = Math.random() * (0.35 - 0.15) + 0.15;
      return {
        ...c,
        fuelSurchargeRate: parseFloat(randomFuelRate.toFixed(4)),
        createdBy: anAdminUserId
      };
    });
    const createdCustomers = await Customer.insertMany(customersWithFuelRate);
    console.log(`${createdCustomers.length} customers created.`);
    createdCustomers.forEach(c => console.log(`Customer: ${c.name}, Fuel Surcharge Rate: ${c.fuelSurchargeRate}`));
    const customerIds = {
        alpha: createdCustomers.find(c => c.name === 'Alpha Corp')?._id,
        beta: createdCustomers.find(c => c.name === 'Beta LLC')?._id,
        gamma: createdCustomers.find(c => c.name === 'Gamma Inc')?._id,
        delta: createdCustomers.find(c => c.name === 'Delta Co')?._id,
        epsilon: createdCustomers.find(c => c.name === 'Epsilon Ltd')?._id,
    };

    // 3. Create Non-Logging-In Drivers
    console.log('Creating sample non-logging-in drivers...');
    const driversToCreate = sampleNewDriversData.map(d => ({ ...d, createdBy: anAdminUserId }));
    const createdNewDrivers = await Driver.insertMany(driversToCreate);
    console.log(`${createdNewDrivers.length} non-logging-in drivers created.`);
    // Create driverIds map for shipments based on new Driver model
    const driverIds = {
        john: createdNewDrivers.find(d => d.firstName === 'John' && d.lastName === 'Truckman')?._id,
        jane: createdNewDrivers.find(d => d.firstName === 'Jane' && d.lastName === 'Hauler')?._id,
        bob: createdNewDrivers.find(d => d.firstName === 'Robert' && d.lastName === 'Wheels')?._id,
    };
    const aSystemUserId = anAdminUserId || (createdSystemUsers.length > 0 ? createdSystemUsers[0]._id : null);

    // 4. Create Shipments
    console.log('Creating sample shipments...');
    const shipmentsToCreate = sampleShipmentsData(driverIds, customerIds).map(s => ({...s, createdBy: aSystemUserId }));
    // Using a loop with .save() instead of insertMany to ensure pre-save hooks are triggered reliably
    const createdShipments = [];
    for (const shipmentData of shipmentsToCreate) {
        const shipment = new Shipment(shipmentData);
        await shipment.save();
        createdShipments.push(shipment);
    }
    console.log(`${createdShipments.length} shipments created.`);
    
    // 5. Create Invoices
    console.log('Creating sample invoices...');
    const invoicesToCreate = sampleInvoicesData(createdShipments, aSystemUserId);
    const createdInvoices = [];
    for (const invData of invoicesToCreate) {
        const invoice = new Invoice(invData);
        await invoice.save();
        createdInvoices.push(invoice);
    }
    console.log(`${createdInvoices.length} invoices created.`);

    const invoicesInDbAfterSeed = await Invoice.find({});
    console.log(`[performSeed] Verification: Found ${invoicesInDbAfterSeed.length} invoices in DB immediately after saving.`);


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


module.exports = { performSeed };