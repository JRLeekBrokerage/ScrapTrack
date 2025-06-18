require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('./src/models/Customer');
const Driver = require('./src/models/Driver');
const User = require('./src/models/User');

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scraptrack', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get admin user for createdBy field
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      console.error('Admin user not found. Please run createTestUser.js first.');
      process.exit(1);
    }

    // Create test customers
    const customers = [
      {
        companyName: 'Union Iron and Metal',
        customerCode: 'UIM1',
        primaryContact: {
          name: 'John Smith',
          title: 'Purchasing Manager',
          email: 'john.smith@unioniron.com',
          phone: '(330) 555-1234'
        },
        billingAddress: {
          street1: '1234 Industrial Blvd',
          city: 'Cleveland',
          state: 'OH',
          zipCode: '44101',
          country: 'USA'
        },
        paymentTerms: 'Net 30',
        creditLimit: 50000,
        defaultFuelSurchargeRate: 0.35,
        status: 'active',
        businessType: 'Corporation',
        industry: 'Metal Recycling',
        createdBy: adminUser._id
      },
      {
        companyName: 'Midwest Scrap Processing',
        customerCode: 'MSP1',
        primaryContact: {
          name: 'Sarah Johnson',
          title: 'Operations Director',
          email: 'sarah@midwestscrap.com',
          phone: '(216) 555-5678'
        },
        billingAddress: {
          street1: '5678 Recycling Way',
          city: 'Akron',
          state: 'OH',
          zipCode: '44301',
          country: 'USA'
        },
        paymentTerms: 'Due Upon Receipt',
        creditLimit: 75000,
        defaultFuelSurchargeRate: 0.35,
        status: 'active',
        businessType: 'LLC',
        industry: 'Scrap Metal Processing',
        createdBy: adminUser._id
      },
      {
        companyName: 'ABC Metal Works',
        customerCode: 'ABC1',
        primaryContact: {
          name: 'Mike Brown',
          title: 'Owner',
          email: 'mike@abcmetalworks.com',
          phone: '(330) 555-9012'
        },
        billingAddress: {
          street1: '910 Commerce Dr',
          city: 'Canton',
          state: 'OH',
          zipCode: '44701',
          country: 'USA'
        },
        paymentTerms: 'Net 15',
        creditLimit: 25000,
        defaultFuelSurchargeRate: 0.35,
        status: 'active',
        businessType: 'Sole Proprietorship',
        industry: 'Metal Fabrication',
        createdBy: adminUser._id
      }
    ];

    // Check and create customers
    console.log('\nCreating customers...');
    for (const customerData of customers) {
      const existing = await Customer.findOne({ companyName: customerData.companyName });
      if (!existing) {
        const customer = new Customer(customerData);
        await customer.save();
        console.log(`Created customer: ${customer.companyName} (${customer.customerCode})`);
      } else {
        console.log(`Customer already exists: ${existing.companyName}`);
      }
    }

    // Create test drivers
    const drivers = [
      {
        employeeId: 'DRV0001',
        firstName: 'Robert',
        lastName: 'Johnson',
        email: 'robert.johnson@leekbrokerage.com',
        phoneNumber: '(330) 555-3456',
        address: {
          street1: '123 Main St',
          city: 'Canton',
          state: 'OH',
          zipCode: '44702'
        },
        licenseNumber: 'OH123456',
        licenseState: 'OH',
        licenseExpiration: new Date('2026-12-31'),
        licenseClass: 'CDL-A',
        hireDate: new Date('2020-01-15'),
        status: 'active',
        employmentType: 'full-time',
        truckNumber: 'T101',
        commissionRate: 0.25,
        commissionType: 'percentage',
        emergencyContact: {
          name: 'Mary Johnson',
          relationship: 'Spouse',
          phoneNumber: '(330) 555-3457'
        },
        createdBy: adminUser._id
      },
      {
        employeeId: 'DRV0002',
        firstName: 'Michael',
        lastName: 'Williams',
        email: 'michael.williams@leekbrokerage.com',
        phoneNumber: '(330) 555-7890',
        address: {
          street1: '456 Oak Ave',
          city: 'Massillon',
          state: 'OH',
          zipCode: '44646'
        },
        licenseNumber: 'OH789012',
        licenseState: 'OH',
        licenseExpiration: new Date('2025-06-30'),
        licenseClass: 'CDL-A',
        hireDate: new Date('2019-03-20'),
        status: 'active',
        employmentType: 'full-time',
        truckNumber: 'T102',
        commissionRate: 0.28,
        commissionType: 'percentage',
        emergencyContact: {
          name: 'Linda Williams',
          relationship: 'Spouse',
          phoneNumber: '(330) 555-7891'
        },
        createdBy: adminUser._id
      },
      {
        employeeId: 'DRV0003',
        firstName: 'James',
        lastName: 'Davis',
        email: 'james.davis@leekbrokerage.com',
        phoneNumber: '(216) 555-2345',
        address: {
          street1: '789 Elm St',
          city: 'North Canton',
          state: 'OH',
          zipCode: '44720'
        },
        licenseNumber: 'OH345678',
        licenseState: 'OH',
        licenseExpiration: new Date('2025-09-15'),
        licenseClass: 'CDL-B',
        hireDate: new Date('2021-06-01'),
        status: 'active',
        employmentType: 'full-time',
        truckNumber: 'T103',
        commissionRate: 0.23,
        commissionType: 'percentage',
        emergencyContact: {
          name: 'Patricia Davis',
          relationship: 'Wife',
          phoneNumber: '(216) 555-2346'
        },
        createdBy: adminUser._id
      },
      {
        employeeId: 'DRV0004',
        firstName: 'David',
        lastName: 'Miller',
        email: 'david.miller@leekbrokerage.com',
        phoneNumber: '(330) 555-6789',
        address: {
          street1: '321 Pine Rd',
          city: 'Alliance',
          state: 'OH',
          zipCode: '44601'
        },
        licenseNumber: 'OH901234',
        licenseState: 'OH',
        licenseExpiration: new Date('2026-03-31'),
        licenseClass: 'CDL-A',
        hireDate: new Date('2018-11-10'),
        status: 'active',
        employmentType: 'contractor',
        truckNumber: 'T104',
        commissionRate: 0.30,
        commissionType: 'percentage',
        emergencyContact: {
          name: 'Susan Miller',
          relationship: 'Wife',
          phoneNumber: '(330) 555-6790'
        },
        createdBy: adminUser._id
      }
    ];

    // Check and create drivers
    console.log('\nCreating drivers...');
    for (const driverData of drivers) {
      const existing = await Driver.findOne({ 
        $or: [
          { employeeId: driverData.employeeId },
          { licenseNumber: driverData.licenseNumber }
        ]
      });
      
      if (!existing) {
        const driver = new Driver(driverData);
        await driver.save();
        console.log(`Created driver: ${driver.fullName} (${driver.employeeId})`);
      } else {
        console.log(`Driver already exists: ${existing.fullName}`);
      }
    }

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\nYou can now create invoices with:');
    console.log('- 3 test customers');
    console.log('- 4 test drivers');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
