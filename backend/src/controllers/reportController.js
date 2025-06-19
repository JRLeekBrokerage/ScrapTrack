const Shipment = require('../models/Shipment');
const User = require('../models/User');
const Invoice = require('../models/Invoice'); // Added Invoice model
const mongoose = require('mongoose');
const { validationResult } = require('express-validator'); // Removed query as it's used in routes
const PDFDocument = require('pdfkit'); // Added PDFKit

// GET /api/reports/commission
const getDriverCommissionReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { driverId, startDate, endDate, format = 'json' } = req.query; // Added format

    const matchConditions = {
      status: 'delivered',
      // commissionCalculatedDate: null, // Consider if you want to strictly enforce this or allow re-generation
    };

    if (driverId) {
      if (!mongoose.Types.ObjectId.isValid(driverId)) {
        return res.status(400).json({ success: false, message: 'Invalid driverId format' });
      }
      matchConditions.driver = new mongoose.Types.ObjectId(driverId);
    }

    if (startDate || endDate) {
      matchConditions.actualDeliveryDate = {};
      if (startDate) {
        matchConditions.actualDeliveryDate.$gte = new Date(startDate);
      }
      if (endDate) {
        // To include the whole end day, set to end of day
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        matchConditions.actualDeliveryDate.$lte = endOfDay;
      }
    }
    
    // Find shipments and populate driver details to access commissionRate
    const shipments = await Shipment.find(matchConditions)
      .populate({
        path: 'driver',
        select: 'username firstName lastName email commissionRate role', // Ensure commissionRate is selected
        match: { role: 'driver' } // Ensure the populated user is actually a driver
      })
      .sort({ actualDeliveryDate: 1 }); // Sort by delivery date

    if (!shipments || shipments.length === 0) {
      return res.status(200).json({ success: true, message: 'No shipments found matching criteria for commission report.', data: [] });
    }

    const PAYMENT_RATE_PER_POUND = 0.008; // As per business logic example
    const MINIMUM_PAYMENT_WEIGHT = 40000; // As per business logic

    const commissionReport = shipments.filter(shipment => shipment.driver && shipment.driver.commissionRate != null)
      .map(shipment => {
        const actualWeight = shipment.totalWeight || (shipment.items ? shipment.items.reduce((acc, item) => acc + (item.weight || 0), 0) : 0);
        const effectiveWeightForPayment = Math.max(actualWeight, MINIMUM_PAYMENT_WEIGHT);
        
        // Calculate the base amount for commission based on the new rules
        // This 'commissionBaseAmount' is what the Excel 'Amount' column seems to represent for driver payment.
        // Note: This might differ from shipment.freightCost if freightCost is the customer charge.
        // For now, we are RECALCULATING the base for commission.
        const commissionBaseAmount = effectiveWeightForPayment * PAYMENT_RATE_PER_POUND;

        const commissionAmount = commissionBaseAmount * (shipment.driver.commissionRate || 0);
        
        return {
          date: shipment.actualDeliveryDate || shipment.estimatedDeliveryDate || shipment.pickupDate,
          shipmentId: shipment.shipmentId,
          destination: shipment.destination ? `${shipment.destination.city}, ${shipment.destination.state}` : 'N/A',
          driverName: shipment.driver ? `${shipment.driver.firstName} ${shipment.driver.lastName}` : 'N/A',
          driverUsername: shipment.driver ? shipment.driver.username : 'N/A',
          truckNumber: shipment.truckNumber || 'N/A',
          // 'price' (Pice from Excel) is still ambiguous. Omitting for now.
          weight: actualWeight, // Show actual weight hauled
          effectiveWeightForPayment: effectiveWeightForPayment, // For clarity or if needed on report
          amount: parseFloat(commissionBaseAmount.toFixed(2)), // This is the base for commission
          commissionRate: shipment.driver.commissionRate,
          commissionAmount: parseFloat(commissionAmount.toFixed(2)),
        };
      });
// Helper function to generate Commission Report PDF
const generateCommissionReportPdf = (reportData, res) => {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER', layout: 'landscape' }); // Use landscape for more columns

  const safeDriverName = reportData.driverName.replace(/[^a-zA-Z0-9]/g, '_') || 'AllDrivers';
  const safePeriod = reportData.period.replace(/[^a-zA-Z0-9-]/g, '_') || 'AllTime';
  const filename = `DriverCommissionReport-${safeDriverName}-${safePeriod}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  doc.pipe(res);

  // --- PDF Content ---
  doc.fontSize(18).text(reportData.reportTitle, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Driver: ${reportData.driverName}`, { align: 'left' });
  doc.text(`Period: ${reportData.period}`, { align: 'left' });
  doc.moveDown();

  // Table Header
  const tableTop = doc.y;
  const startX = 50;
  const colWidths = [60, 70, 100, 100, 60, 70, 70, 50, 70]; // Date, Ship#, Dest, Driver, Truck#, Weight, Amount, Rate, Commission
  let currentX = startX;

  doc.fontSize(9); // Smaller font for table
  const headers = ['Date', 'Shipment #', 'Destination', 'Driver', 'Truck #', 'Weight', 'Amount', 'Rate', 'Commission'];
  
  headers.forEach((header, i) => {
    doc.text(header, currentX, tableTop, { width: colWidths[i], lineBreak: false, align: 'left' });
    currentX += colWidths[i];
  });
  doc.moveDown(0.5);
  const tableHeaderBottom = doc.y;
  doc.moveTo(startX, tableHeaderBottom).lineTo(doc.page.width - startX, tableHeaderBottom).stroke();
  doc.moveDown();

  // Table Rows
  reportData.items.forEach(item => {
    currentX = startX;
    const rowY = doc.y;
    const rowValues = [
      item.date ? new Date(item.date).toLocaleDateString() : 'N/A',
      item.shipmentId || 'N/A',
      item.destination || 'N/A',
      item.driverName || item.driverUsername || 'N/A',
      item.truckNumber || 'N/A',
      item.weight != null ? item.weight.toLocaleString() : 'N/A',
      item.amount != null ? '$' + item.amount.toFixed(2) : 'N/A',
      item.commissionRate != null ? (item.commissionRate * 100).toFixed(0) + '%' : 'N/A',
      item.commissionAmount != null ? '$' + item.commissionAmount.toFixed(2) : 'N/A'
    ];

    rowValues.forEach((value, i) => {
      doc.text(value.toString(), currentX, rowY, { width: colWidths[i], lineBreak: false, align: (i >= 5 ? 'right' : 'left') }); // Align numeric columns to right
      currentX += colWidths[i];
    });
    doc.moveDown(1.2); 
    if (doc.y > doc.page.height - 70) { // Check for page break
        doc.addPage({ margin: 50, size: 'LETTER', layout: 'landscape' });
        // Redraw headers on new page if needed (simplified here)
    }
  });
  const tableBottom = doc.y;
  doc.moveTo(startX, tableBottom).lineTo(doc.page.width - startX, tableBottom).stroke();
  doc.moveDown();

  // Total Commission
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(`Total Commission: $${reportData.totalCommission.toFixed(2)}`, { align: 'right' });
  doc.font('Helvetica');

  doc.end();
};

    // Optional: Update commissionCalculatedDate for these shipments
    // const shipmentIdsToUpdate = commissionReport.map(r => r.shipmentId);
    // await Shipment.updateMany({ _id: { $in: shipments.map(s => s._id) } }, { commissionCalculatedDate: new Date() });

    if (format === 'pdf') {
      // Prepare data specifically for the PDF if needed, or pass commissionReport directly
      const pdfReportData = {
        reportTitle: "Driver Commission Report",
        driverName: driverId ? (commissionReport.length > 0 ? commissionReport[0].driverName : 'N/A') : 'All Drivers',
        period: startDate && endDate ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}` : 'All Time',
        items: commissionReport,
        totalCommission: commissionReport.reduce((sum, item) => sum + (item.commissionAmount || 0), 0)
      };
      generateCommissionReportPdf(pdfReportData, res);
    } else {
      res.json({ success: true, data: commissionReport });
    }

  } catch (error) {
    console.error('Get Driver Commission Report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate driver commission report', error: error.message });
  }
};

// Helper function to generate PDF
const generateInvoicePdf = (reportData, res) => {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

  // Set headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Invoice-${reportData.invoiceNumber}.pdf`);
  doc.pipe(res);

  // --- PDF Content ---

  // Header
  doc.fontSize(20).text(reportData.brokerageName, { align: 'left' });
  doc.fontSize(10).text(`Invoice #: ${reportData.invoiceNumber}`, { align: 'right' });
  doc.text(`Date: ${new Date(reportData.invoiceDate).toLocaleDateString()}`, { align: 'right' });
  doc.moveDown();

  // Bill To
  doc.fontSize(12).text('Bill To:', { underline: true });
  doc.text(reportData.billTo);
  doc.moveDown();

  // Project Description
  if (reportData.projectDescription && reportData.projectDescription !== "N/A") {
    doc.text('For:', { underline: true });
    doc.text(reportData.projectDescription);
    doc.moveDown();
  }

  // Shipments Table Header
  const tableTop = doc.y;
  const itemCol = 50;
  const dateCol = itemCol;
  const shippingNoCol = dateCol + 80;
  const destinationCol = shippingNoCol + 80;
  const driverCol = destinationCol + 120;
  const truckNoCol = driverCol + 100;
  // const priceCol = truckNoCol + 50; // Price per unit might be too wide
  const weightCol = truckNoCol + 50;
  const amountCol = weightCol + 60;

  doc.fontSize(10);
  doc.text('Date', dateCol, tableTop, { width: 70, lineBreak: false });
  doc.text('Shipping #', shippingNoCol, tableTop, { width: 70, lineBreak: false });
  doc.text('Destination', destinationCol, tableTop, { width: 110, lineBreak: false });
  doc.text('Driver', driverCol, tableTop, { width: 90, lineBreak: false });
  doc.text('Trk #', truckNoCol, tableTop, { width: 40, lineBreak: false });
  // doc.text('Price', priceCol, tableTop, { width: 50, align: 'right', lineBreak: false });
  doc.text('Weight', weightCol, tableTop, { width: 50, align: 'right', lineBreak: false });
  doc.text('Amount', amountCol, tableTop, { width: 70, align: 'right' });
  doc.moveDown(0.5);
  const tableHeaderBottom = doc.y;
  doc.moveTo(itemCol, tableHeaderBottom).lineTo(doc.page.width - itemCol, tableHeaderBottom).stroke();
  doc.moveDown();

  // Shipments Table Rows
  reportData.shipmentDetails.forEach(item => {
    const rowY = doc.y;
    doc.text(new Date(item.date).toLocaleDateString(), dateCol, rowY, { width: 70, lineBreak: false });
    doc.text(item.shippingNumber, shippingNoCol, rowY, { width: 70, lineBreak: false });
    doc.text(item.destination, destinationCol, rowY, { width: 110, lineBreak: false });
    doc.text(item.driver, driverCol, rowY, { width: 90, lineBreak: false });
    doc.text(item.truckNumber, truckNoCol, rowY, { width: 40, lineBreak: false });
    // doc.text(item.pricePerUnit.toFixed(2), priceCol, rowY, { width: 50, align: 'right', lineBreak: false });
    doc.text(item.weight.toFixed(2), weightCol, rowY, { width: 50, align: 'right', lineBreak: false });
    doc.text(item.amount.toFixed(2), amountCol, rowY, { width: 70, align: 'right' });
    doc.moveDown(1.5); // Adjust spacing as needed
  });
  const tableBottom = doc.y;
  doc.moveTo(itemCol, tableBottom).lineTo(doc.page.width - itemCol, tableBottom).stroke();
  doc.moveDown();

  // Totals
  const totalsX = 400;
  doc.fontSize(10);
  doc.text(`Total Items: ${reportData.totalItems}`, totalsX, undefined, { align: 'right' });
  doc.text(`Subtotal: ${reportData.subTotal.toFixed(2)}`, totalsX, undefined, { align: 'right' });
  doc.text(`Fuel Surcharge: ${reportData.fuelSurcharge.toFixed(2)}`, totalsX, undefined, { align: 'right' });
  if (reportData.deposit > 0) {
    doc.text(`Deposit: ${reportData.deposit.toFixed(2)}`, totalsX, undefined, { align: 'right' });
  }
  doc.font('Helvetica-Bold').text(`Invoice Total: ${reportData.invoiceTotal.toFixed(2)}`, totalsX, undefined, { align: 'right' });
  doc.font('Helvetica');
  doc.moveDown(2);

  // Footer
  doc.fontSize(10).text(`Make all checks payable to: ${reportData.payableTo}`);
  doc.moveDown();
  doc.text(`If you have any questions concerning this invoice, contact:`);
  doc.text(`${reportData.contactPerson} - ${reportData.contactPhone} - ${reportData.contactEmail}`);
  doc.moveDown();
  doc.text(reportData.brokerageAddressLine1);
  doc.text(reportData.brokerageAddressLine2);
  doc.text(`Phone: ${reportData.brokerageMainPhone}`);
  doc.moveDown(2);
  doc.fontSize(12).text(reportData.thankYouMessage, { align: 'center' });

  doc.end();
};

// GET /api/reports/invoice/:invoiceId
const getInvoiceReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { invoiceId } = req.params;
    const { format = 'json' } = req.query; // Default to json if not specified

    const invoice = await Invoice.findById(invoiceId)
      .populate({
        path: 'shipments',
        populate: {
          path: 'driver',
          select: 'firstName lastName username email' // Select fields for driver
        }
      })
      .populate('createdBy', 'firstName lastName email phone'); // Select fields for invoice creator

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Static brokerage information (as per Excel example)
    // TODO: Move this to a configuration file or a dedicated settings model
    const brokerageInfo = {
      name: "Leek Brokerage",
      payableTo: "Leek Brokerage Inc",
      addressLine1: "P.O. Box 20145",
      addressLine2: "Canton, Oh 44701",
      mainPhone: "2312148200", // From Excel, seems like a typo, original was 330-324-5421 for James
    };

    const reportData = {
      brokerageName: brokerageInfo.name,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.issueDate,
      billTo: invoice.billTo.name,
      projectDescription: invoice.notes || "N/A", // Using notes for project description

      shipmentDetails: invoice.shipments.map(shipment => ({
        date: shipment.actualPickupDate || shipment.pickupDate,
        shippingNumber: shipment.shipmentId,
        destination: shipment.destination ? `${shipment.destination.city}, ${shipment.destination.state}` : 'N/A',
        driver: shipment.driver ? `${shipment.driver.firstName} ${shipment.driver.lastName}` : 'N/A',
        truckNumber: shipment.truckNumber || 'N/A',
        // Price per unit (e.g., per ton) is not directly available.
        // Excel shows Price * Weight = Amount. We have freightCost (Amount) and totalWeight.
        pricePerUnit: (shipment.totalWeight && shipment.totalWeight !== 0) ? (shipment.freightCost / shipment.totalWeight) : 0,
        weight: shipment.totalWeight || 0,
        amount: shipment.freightCost || 0,
      })),

      totalItems: invoice.shipments.length,
      subTotal: invoice.subTotal,
      fuelSurcharge: invoice.fuelSurchargeAmount, // Using the calculated amount
      // The Excel has "TaxRate" for fuel surcharge calculation, we have fuelSurchargeRate on invoice.
      // The example shows 0.35 for fuel surcharge, which is likely a fixed amount or a misinterpretation of the Excel.
      // For now, using the calculated fuelSurchargeAmount from the invoice model.
      deposit: invoice.depositAmount,
      invoiceTotal: invoice.totalAmount,

      payableTo: brokerageInfo.payableTo,
      contactPerson: invoice.createdBy ? `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}` : 'N/A',
      contactPhone: invoice.createdBy ? invoice.createdBy.phone : 'N/A',
      contactEmail: invoice.createdBy ? invoice.createdBy.email : 'N/A',
      brokerageAddressLine1: brokerageInfo.addressLine1,
      brokerageAddressLine2: brokerageInfo.addressLine2,
      brokerageMainPhone: brokerageInfo.mainPhone,
      dueUponReceipt: true, // As per Excel
      thankYouMessage: "Thank you for your business!" // As per Excel
    };

    if (format === 'pdf') {
      generateInvoicePdf(reportData, res);
    } else {
      res.json({ success: true, data: reportData });
    }

  } catch (error) {
    console.error('Get Invoice Report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate invoice report', error: error.message });
  }
};

module.exports = {
  getDriverCommissionReport,
  getInvoiceReport, // Added new controller
};