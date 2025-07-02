require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Shipment = require('../src/models/Shipment');
const Invoice = require('../src/models/Invoice');

const connectAndRun = async () => {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
        console.error('Error: MONGODB_URI not found in .env file.');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('MongoDB connected for date correction script.');

        // --- Correct Shipments ---
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
            // Add 1 day (24 hours) to each date to correct for timezone shift
            if (shipment.deliveryDate && shipment.deliveryDate instanceof Date) {
                shipment.deliveryDate.setDate(shipment.deliveryDate.getDate() + 1);
                updated = true;
            }
            if (shipment.actualPickupDate && shipment.actualPickupDate instanceof Date) {
                shipment.actualPickupDate.setDate(shipment.actualPickupDate.getDate() + 1);
                updated = true;
            }
            if (shipment.actualDeliveryDate && shipment.actualDeliveryDate instanceof Date) {
                shipment.actualDeliveryDate.setDate(shipment.actualDeliveryDate.getDate() + 1);
                updated = true;
            }

            if (updated) {
                await shipment.save();
                shipmentsUpdated++;
            }
        }
        console.log(`Processed ${shipmentsToFix.length} shipments, updated ${shipmentsUpdated}.`);

        // --- Correct Invoices ---
        const invoicesToFix = await Invoice.find({ dueDate: { $ne: null } });
        let invoicesUpdated = 0;
        for (const invoice of invoicesToFix) {
            if (invoice.dueDate && invoice.dueDate instanceof Date) {
                invoice.dueDate.setDate(invoice.dueDate.getDate() + 1);
                await invoice.save();
                invoicesUpdated++;
            }
        }
        console.log(`Processed and updated ${invoicesUpdated} invoices.`);

        console.log('Date correction script finished successfully.');

    } catch (err) {
        console.error('Error during date correction script:', err);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
        process.exit();
    }
};

connectAndRun();