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
    phone: '5550101001', 
    commissionRate: 0.15,
    permissions: [
        { module: 'freight', actions: ['read', 'update'] },
        { module: 'drivers', actions: ['read'] },
        { module: 'invoicing', actions: ['read'] } 
    ]
  },
  {
    username: 'janedriver',
    email: 'jane.driver@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Driveress',
    role: 'driver',
    phone: '5550102002', 
    commissionRate: 0.12,
    permissions: [
        { module: 'freight', actions: ['read', 'update'] },
        { module: 'drivers', actions: ['read'] },
        { module: 'invoicing', actions: ['read'] } 
    ]
  },
  {
    username: 'bobtrucker',
    email: 'bob.trucker@example.com',
    password: 'password123',
    firstName: 'Bob',
    lastName: 'Trucker',
    role: 'driver',
    phone: '5550103003', 
    commissionRate: 0.10,
    permissions: [
        { module: 'freight', actions: ['read', 'update'] },
        { module: 'drivers', actions: ['read'] },
        { module: 'invoicing', actions: ['read'] } 
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
  {
    shippingNumber: 'SHJ0001', status: 'delivered', truckNumber: 'T-101',
    destination: { street: '456 Destination Ave', city: 'Destination City', state: 'NV', zipCode: '89001', country: 'USA' },
    deliveryDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), 
    actualPickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.alpha,
    weight: 35000, rate: (280.00 / 35000), freightCost: 280.00,
  },
  {
    shippingNumber: 'SHJ0002', status: 'delivered', truckNumber: 'T-101',
    destination: { street: '457 Destination Ave', city: 'Destination City', state: 'NV', zipCode: '89001', country: 'USA' },
    deliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), 
    actualPickupDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.alpha,
    weight: 45000, rate: (360.00 / 45000), freightCost: 360.00,
  },
  {
    shippingNumber: 'SHJ0003', status: 'delivered', truckNumber: 'T-102',
    destination: { street: '458 Destination Ave', city: 'Destination City', state: 'NV', zipCode: '89001', country: 'USA' },
    deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), 
    actualPickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.gamma,
    weight: 25000, rate: (200.00 / 25000), freightCost: 200.00,
  },
  {
    shippingNumber: 'SHJA001', status: 'delivered', truckNumber: 'T-201',
    destination: { street: '101 Target Ln', city: 'Targetown', state: 'TX', zipCode: '75001', country: 'USA' },
    deliveryDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), 
    actualPickupDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.beta,
    weight: 52000, rate: (416.00 / 52000), freightCost: 416.00,
  },
  {
    shippingNumber: 'SHJA002', status: 'delivered', truckNumber: 'T-201',
    destination: { street: '102 Target Ln', city: 'Targetown', state: 'TX', zipCode: '75001', country: 'USA' },
    deliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 
    actualPickupDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.beta,
    weight: 15000, rate: (120.00 / 15000), freightCost: 120.00,
  },
  {
    shippingNumber: 'SHB0001', status: 'delivered', truckNumber: 'T-301',
    destination: { street: '654 End Ave', city: 'End City', state: 'GA', zipCode: '30001', country: 'USA' },
    deliveryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), 
    actualPickupDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.delta,
    weight: 60000, rate: (480.00 / 60000), freightCost: 480.00,
  },
  {
    shippingNumber: 'SHB0002', status: 'delivered', truckNumber: 'T-302',
    destination: { street: '655 End Ave', city: 'End City', state: 'GA', zipCode: '30001', country: 'USA' },
    deliveryDate: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000), 
    actualPickupDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.epsilon,
    weight: 30000, rate: (240.00 / 30000), freightCost: 240.00,
  },
  {
    shippingNumber: 'SHB0003', status: 'delivered', truckNumber: 'T-301',
    destination: { street: '656 End Ave', city: 'End City', state: 'GA', zipCode: '30001', country: 'USA' },
    deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), 
    driver: driverIds.bob, customer: customerIds.delta,
    weight: 10000, rate: (80.00 / 10000), freightCost: 80.00,
  },
  {
    shippingNumber: 'SHJ0004', status: 'delivered', truckNumber: 'T-103',
    destination: { street: '777 Test St', city: 'Testville', state: 'CA', zipCode: '90211', country: 'USA' },
    deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.beta,
    weight: 22000, rate: (176.00 / 22000), freightCost: 176.00,
  },
  {
    shippingNumber: 'SHJA003', status: 'delivered', truckNumber: 'T-202',
    destination: { street: '888 Sample Rd', city: 'Sampleburg', state: 'AZ', zipCode: '85003', country: 'USA' },
    deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.gamma,
    weight: 33000, rate: (264.00 / 33000), freightCost: 264.00,
  },
  {
    shippingNumber: 'SHB0004', status: 'delivered', truckNumber: 'T-303',
    destination: { street: '999 Demo Ave', city: 'Demoville', state: 'FL', zipCode: '33002', country: 'USA' },
    deliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.alpha,
    weight: 41000, rate: (328.00 / 41000), freightCost: 328.00,
  },
  {
    shippingNumber: 'SHJ0005', status: 'delivered', truckNumber: 'T-101',
    destination: { street: '121 First St', city: 'First City', state: 'NV', zipCode: '89002', country: 'USA' },
    deliveryDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.delta,
    weight: 38000, rate: (304.00 / 38000), freightCost: 304.00,
  },
  {
    shippingNumber: 'SHJA004', status: 'delivered', truckNumber: 'T-202',
    destination: { street: '232 Second Ave', city: 'Secondtown', state: 'TX', zipCode: '75002', country: 'USA' },
    deliveryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.epsilon,
    weight: 47000, rate: (376.00 / 47000), freightCost: 376.00,
  },
  {
    shippingNumber: 'SHB0005', status: 'delivered', truckNumber: 'T-301',
    destination: { street: '343 Third Blvd', city: 'Thirdville', state: 'GA', zipCode: '30002', country: 'USA' },
    deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.beta,
    weight: 12000, rate: (96.00 / 12000), freightCost: 96.00,
  },
  {
    shippingNumber: 'SHJ0006', status: 'delivered', truckNumber: 'T-103',
    destination: { street: '454 Fourth St', city: 'Fourthcity', state: 'CA', zipCode: '90212', country: 'USA' },
    deliveryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.gamma,
    weight: 28000, rate: (224.00 / 28000), freightCost: 224.00,
  },
  {
    shippingNumber: 'SHJA005', status: 'delivered', truckNumber: 'T-201',
    destination: { street: '565 Fifth Ave', city: 'Fifthtown', state: 'AZ', zipCode: '85004', country: 'USA' },
    deliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 0.2 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.alpha,
    weight: 31000, rate: (248.00 / 31000), freightCost: 248.00,
  },
  {
    shippingNumber: 'SHB0006', status: 'delivered', truckNumber: 'T-303',
    destination: { street: '676 Sixth Ln', city: 'Sixthville', state: 'NV', zipCode: '89004', country: 'USA' },
    deliveryDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.epsilon,
    weight: 55000, rate: (440.00 / 55000), freightCost: 440.00,
  },
  {
    shippingNumber: 'SHJ0007', status: 'delivered', truckNumber: 'T-102',
    destination: { street: '787 Seventh Rd', city: 'Seventhburg', state: 'TX', zipCode: '75005', country: 'USA' },
    deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.delta,
    weight: 19000, rate: (152.00 / 19000), freightCost: 152.00,
  },
  {
    shippingNumber: 'SHJA006', status: 'delivered', truckNumber: 'T-203',
    destination: { street: '898 Eighth Ave', city: 'Eighthville', state: 'FL', zipCode: '33006', country: 'USA' },
    deliveryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.alpha,
    weight: 25000, rate: (200.00 / 25000), freightCost: 200.00,
  },
  {
    shippingNumber: 'SHB0007', status: 'delivered', truckNumber: 'T-304',
    destination: { street: '101 Ninth St', city: 'Ninthburg', state: 'GA', zipCode: '30007', country: 'USA' },
    deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.beta,
    weight: 32000, rate: (256.00 / 32000), freightCost: 256.00,
  },
  {
    shippingNumber: 'SHJ0008', status: 'delivered', truckNumber: 'T-104',
    destination: { street: '202 Tenth Rd', city: 'Tenthville', state: 'CA', zipCode: '90213', country: 'USA' },
    deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 0.1 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.gamma,
    weight: 42000, rate: (336.00 / 42000), freightCost: 336.00,
  },
  {
    shippingNumber: 'SHJA007', status: 'delivered', truckNumber: 'T-201',
    destination: { street: '303 Eleventh Ave', city: 'Eleventh City', state: 'AZ', zipCode: '85005', country: 'USA' },
    deliveryDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.delta,
    weight: 36000, rate: (288.00 / 36000), freightCost: 288.00,
  },
  {
    shippingNumber: 'SHB0008', status: 'delivered', truckNumber: 'T-302',
    destination: { street: '404 Twelfth St', city: 'Twelfthtown', state: 'NV', zipCode: '89005', country: 'USA' },
    deliveryDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.epsilon,
    weight: 15000, rate: (120.00 / 15000), freightCost: 120.00,
  },
  {
    shippingNumber: 'SHJ0009', status: 'delivered', truckNumber: 'T-101',
    destination: { street: '505 Thirteenth Blvd', city: 'Thirteenthville', state: 'TX', zipCode: '75006', country: 'USA' },
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.alpha,
    weight: 29000, rate: (232.00 / 29000), freightCost: 232.00,
  },
  {
    shippingNumber: 'SHJA008', status: 'delivered', truckNumber: 'T-202',
    destination: { street: '606 Fourteenth Ln', city: 'Fourteenthburg', state: 'FL', zipCode: '33007', country: 'USA' },
    deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 0.3 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.beta,
    weight: 34000, rate: (272.00 / 34000), freightCost: 272.00,
  },
  {
    shippingNumber: 'SHB0009', status: 'delivered', truckNumber: 'T-303',
    destination: { street: '707 Fifteenth Rd', city: 'Fifteenth City', state: 'GA', zipCode: '30008', country: 'USA' },
    deliveryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.gamma,
    weight: 58000, rate: (464.00 / 58000), freightCost: 464.00,
  },
  {
    shippingNumber: 'SHJ0010', status: 'pending', truckNumber: 'T-102',
    destination: { street: '808 Sixteenth Ave', city: 'Sixteenthtown', state: 'CA', zipCode: '90214', country: 'USA' },
    deliveryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.delta,
    weight: 21000, rate: (168.00 / 21000), freightCost: 168.00,
  },
  {
    shippingNumber: 'SHJA009', status: 'assigned', truckNumber: 'T-203',
    destination: { street: '909 Seventeenth St', city: 'Seventeenthville', state: 'AZ', zipCode: '85006', country: 'USA' },
    deliveryDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    driver: driverIds.jane, customer: customerIds.epsilon,
    weight: 27000, rate: (216.00 / 27000), freightCost: 216.00,
  },
  {
    shippingNumber: 'SHB0010', status: 'in-transit', truckNumber: 'T-304',
    destination: { street: '111 Eighteenth Blvd', city: 'Eighteenthburg', state: 'NV', zipCode: '89006', country: 'USA' },
    deliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 0.4 * 24 * 60 * 60 * 1000),
    driver: driverIds.bob, customer: customerIds.alpha,
    weight: 39000, rate: (312.00 / 39000), freightCost: 312.00,
  },
  {
    shippingNumber: 'SHJ0011', status: 'delivered', truckNumber: 'T-104',
    destination: { street: '222 Nineteenth Ln', city: 'Nineteenth City', state: 'TX', zipCode: '75007', country: 'USA' },
    deliveryDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    actualPickupDate: new Date(Date.now() - 37 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    driver: driverIds.john, customer: customerIds.beta,
    weight: 43000, rate: (344.00 / 43000), freightCost: 344.00,
  }
];

const sampleInvoicesData = (createdShipments, createdById) => {
  const invoices = [];
  const invoiceStatuses = ['draft', 'sent', 'paid', 'partially-paid', 'overdue', 'void'];
  let invoiceCounter = 1;

  // Use only delivered shipments for invoices initially
  const deliveredShipments = createdShipments.filter(s => s.status === 'delivered');

  for (let i = 0; i < deliveredShipments.length && invoices.length < 30; i++) {
    const shipment = deliveredShipments[i];
    if (!shipment.customer) {
        console.warn(`Shipment ${shipment.shippingNumber} is missing a customer. Skipping invoice creation.`); // Changed to shippingNumber
        continue;
    }

    const issueDate = new Date(Date.now() - (i * 3) * 24 * 60 * 60 * 1000); // Vary issue dates
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Cycle through statuses, but make 'paid' and 'void' less frequent for more open invoices
    let status = invoiceStatuses[i % invoiceStatuses.length];
    if ((status === 'paid' || status === 'void') && Math.random() < 0.6) { // Reduce frequency of final statuses
        status = (i % 3 === 0) ? 'sent' : 'draft'; // Default to sent or draft
    }
    if (status === 'overdue' && dueDate > new Date()) { // Don't make future due dates overdue
        status = 'sent';
    }
    if (status === 'paid' && i % 5 !== 0) { // Make 'paid' less frequent
        status = 'sent';
    }


    invoices.push({
      invoiceNumber: `INV2025-${String(invoiceCounter++).padStart(3, '0')}`,
      customer: shipment.customer, // customerId from the shipment
      issueDate: issueDate,
      dueDate: dueDate,
      shipments: [shipment._id],
      subTotal: shipment.freightCost,
      fuelSurchargeRate: Math.random() * 0.1, // Random fuel surcharge up to 10%
      status: status,
      createdBy: createdById,
      notes: `Invoice for shipment ${shipment.shippingNumber}. Notes for invoice #${invoiceCounter -1}.` // Changed to shippingNumber
    });
  }
  // Ensure we have at least the original 3 if the loop didn't generate enough
   if (invoices.length < 3 && deliveredShipments.length >= 3) {
        const baseShipments = [deliveredShipments[0], deliveredShipments[1], deliveredShipments[2]];
        if(!invoices.find(inv => inv.shipments.includes(baseShipments[0]._id))) {
            invoices.push({
                invoiceNumber: `INV2025-${String(invoiceCounter++).padStart(3, '0')}`,
                customer: baseShipments[0].customer, issueDate: new Date(), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                shipments: [baseShipments[0]._id], subTotal: baseShipments[0].freightCost, fuelSurchargeRate: 0.05, status: 'draft', createdBy: createdById, notes: `Fallback invoice for ${baseShipments[0].shippingNumber}` // Changed to shippingNumber
            });
        }
        if(baseShipments[1] && !invoices.find(inv => inv.shipments.includes(baseShipments[1]._id))) {
             invoices.push({
                invoiceNumber: `INV2025-${String(invoiceCounter++).padStart(3, '0')}`,
                customer: baseShipments[1].customer, issueDate: new Date(), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                shipments: [baseShipments[1]._id], subTotal: baseShipments[1].freightCost, fuelSurchargeRate: 0.07, status: 'sent', createdBy: createdById, notes: `Fallback invoice for ${baseShipments[1].shippingNumber}` // Changed to shippingNumber
            });
        }
        if(baseShipments[2] && !invoices.find(inv => inv.shipments.includes(baseShipments[2]._id))) {
            invoices.push({
                invoiceNumber: `INV2025-${String(invoiceCounter++).padStart(3, '0')}`,
                customer: baseShipments[2].customer, issueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
                shipments: [baseShipments[2]._id], subTotal: baseShipments[2].freightCost, status: 'paid', createdBy: createdById, notes: `Fallback invoice for ${baseShipments[2].shippingNumber}` // Changed to shippingNumber
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
    
    // const shipmentMap = {}; // To map old shipmentId structure if needed by invoices, or pass full objects
    // createdShipments.forEach(s => shipmentMap[s.shipmentId] = s); // Changed to shippingNumber


    // 4. Create Invoices (now needs customerMap if we want to preserve billTo.name logic from old invoice data)
    // For simplicity, sampleInvoicesData now directly uses customerId from the shipment.
    console.log('Creating sample invoices...');
    // const customerObjects = {}; // For easy lookup if needed by sampleInvoicesData
    // createdCustomers.forEach(c => customerObjects[c._id.toString()] = c);

    // Pass all createdShipments to sampleInvoicesData, it will filter for 'delivered'
    const invoicesToCreate = sampleInvoicesData(createdShipments, anExistingUserId); // Pass createdShipments directly
    const createdInvoices = [];
    for (const invData of invoicesToCreate) {
        const invoice = new Invoice(invData);
        // The pre-save hook in Invoice.js will calculate fuelSurchargeAmount and totalAmount
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