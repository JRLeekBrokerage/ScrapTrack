require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Shipment = require('../src/models/Shipment');
const Invoice = require('../src/models/Invoice');

const connectAndRun = async () => {
    // Build MongoDB URI from individual environment variables
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '27017';
    const dbName = process.env.DB_NAME;
    
    if (!dbName) {
        console.error('Error: DB_NAME not found in .env file.');
        process.exit(1);
    }
    
    const mongoURI = `mongodb://${dbHost}:${dbPort}/${dbName}`;
    console.log(`Connecting to MongoDB at: ${mongoURI}`);

    try {
        await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('MongoDB connected for UNDO date correction script.');

        // --- UNDO Shipment Date Corrections (subtract 1 day) ---
        const shipmentsToFix = await Shipment.find({
            $or: [
                { deliveryDate: { $ne: null } },
                { actualPickupDate: { $ne: null } },
                { actualDeliveryDate: { $ne: null } }
            ]
        });

        let shipmentsUpdated = 0;
        for (const shipment of shipmentsToFix) {
            let updated = false;
            // Subtract 1 day (24 hours) from each date to undo the second fix
            if (shipment.deliveryDate && shipment.deliveryDate instanceof Date) {
                shipment.deliveryDate.setDate(shipment.deliveryDate.getDate() - 1);
                updated = true;
            }
            if (shipment.actualPickupDate && shipment.actualPickupDate instanceof Date) {
                shipment.actualPickupDate.setDate(shipment.actualPickupDate.getDate() - 1);
                updated = true;
            }
            if (shipment.actualDeliveryDate && shipment.actualDeliveryDate instanceof Date) {
                shipment.actualDeliveryDate.setDate(shipment.actualDeliveryDate.getDate() - 1);
                updated = true;
            }

            if (updated) {
                await shipment.save();
                shipmentsUpdated++;
            }
        }
        console.log(`Processed ${shipmentsToFix.length} shipments, updated ${shipmentsUpdated} (UNDOING second fix).`);

        // --- UNDO Invoice Date Corrections (subtract 1 day) ---
        const invoicesToFix = await Invoice.find({ dueDate: { $ne: null } });
        let invoicesUpdated = 0;
        for (const invoice of invoicesToFix) {
            if (invoice.dueDate && invoice.dueDate instanceof Date) {
                invoice.dueDate.setDate(invoice.dueDate.getDate() - 1);
                await invoice.save();
                invoicesUpdated++;
            }
        }
        console.log(`Processed and updated ${invoicesUpdated} invoices (UNDOING second fix).`);

        console.log('UNDO date correction script finished successfully.');

    } catch (err) {
        console.error('Error during UNDO date correction script:', err);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
        process.exit();
    }
};

connectAndRun();