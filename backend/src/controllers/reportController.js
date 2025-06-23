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
        const actualWeight = shipment.totalWeight || 0; // shipment.items removed
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
  // Adjusted widths: Date, Ship#, Dest, Driver, Truck#, Weight, Amount, Rate, Commission
  const colWidths = [60, 70, 90, 90, 60, 70, 70, 50, 65]; // Sum = 625. Reduced Dest/Driver.
  let currentX = startX;

  doc.fontSize(9); // Smaller font for table
  const headers = ['Date', 'Shipment #', 'Destination', 'Driver', 'Truck #', 'Weight', 'Amount', 'Rate', 'Commission'];
  
  headers.forEach((header, i) => {
    doc.text(header, currentX, tableTop, {
        width: colWidths[i],
        lineBreak: false,
        align: (i >= 5 ? 'right' : 'left') // Align headers consistent with data
    });
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
  const startX = 50; // Renamed itemCol to startX for clarity
  const pageContentWidth = doc.page.width - startX - startX; // 512

  // Define relative widths, ensure they sum up to <= pageContentWidth
  const colWidthsConfig = [
    { header: 'Date', width: 65, align: 'left' },          // Adjusted width
    { header: 'Shipping #', width: 70, align: 'left' },
    { header: 'Destination', width: 100, align: 'left' }, // Adjusted width
    { header: 'Driver', width: 85, align: 'left' },      // Adjusted width
    { header: 'Trk #', width: 40, align: 'left' },
    { header: 'Weight', width: 60, align: 'right' },     // Adjusted width
    { header: 'Amount', width: 70, align: 'right' }
  ];
  // Sum of new widths: 65+70+100+85+40+60+70 = 490. This fits within 512.

  doc.fontSize(10);
  let currentX = startX;
  colWidthsConfig.forEach(col => {
    doc.text(col.header, currentX, tableTop, { width: col.width, lineBreak: false, align: col.align });
    currentX += col.width;
  });
  doc.moveDown(0.5);
  const tableHeaderBottom = doc.y;
  doc.moveTo(startX, tableHeaderBottom).lineTo(doc.page.width - startX, tableHeaderBottom).stroke(); // Replaced itemCol with startX
  doc.moveDown();

  // Shipments Table Rows
  reportData.shipmentDetails.forEach(item => {
    const rowY = doc.y;
    currentX = startX;
    const rowValues = [
        item.date ? new Date(item.date).toLocaleDateString() : 'N/A',
        item.shippingNumber || 'N/A',
        item.destination || 'N/A',
        item.driver || 'N/A',
        item.truckNumber || 'N/A',
        item.weight != null ? item.weight.toFixed(2) : 'N/A', // Ensure toFixed for consistency
        item.amount != null ? item.amount.toFixed(2) : 'N/A'  // Ensure toFixed for consistency
    ];
    rowValues.forEach((value, i) => {
        doc.text(value.toString(), currentX, rowY, { width: colWidthsConfig[i].width, align: colWidthsConfig[i].align, lineBreak: false });
        currentX += colWidthsConfig[i].width;
    });
    doc.moveDown(1.5);
  });
  const tableBottom = doc.y;
  doc.moveTo(startX, tableBottom).lineTo(doc.page.width - startX, tableBottom).stroke(); // Used startX
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
        populate: [ // Can populate multiple paths within shipments
          { path: 'driver', select: 'firstName lastName username email' },
          // { path: 'customer', select: 'name' } // Customer on shipment already an ID, not needed if invoice.customer is primary
        ]
      })
      .populate('customer', 'name contactEmail contactPhone primaryAddress') // Populate the main customer for the invoice
      .populate('createdBy', 'firstName lastName email phone');

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
      billTo: invoice.customer && invoice.customer.name ? invoice.customer.name : 'N/A', // Use populated customer.name
      projectDescription: invoice.notes || "N/A",

      shipmentDetails: invoice.shipments ? invoice.shipments.map(shipment => {
        const driverName = shipment.driver ? `${shipment.driver.firstName || ''} ${shipment.driver.lastName || ''}`.trim() || shipment.driver.username || 'N/A' : 'N/A';
        const destination = shipment.destination || {};
        // const items = shipment.items || []; // shipment.items removed
        const totalWeight = shipment.totalWeight || 0; // shipment.items removed
        
        return {
            date: shipment.actualPickupDate || shipment.pickupDate,
            shippingNumber: shipment.shipmentId || 'N/A',
            destination: `${destination.city || ''}, ${destination.state || ''}`.trim().replace(/^,|,$/g, '') || 'N/A',
            driver: driverName,
            truckNumber: shipment.truckNumber || 'N/A',
            pricePerUnit: (totalWeight && totalWeight !== 0 && shipment.freightCost != null) ? (shipment.freightCost / totalWeight) : 0,
            weight: totalWeight,
            amount: shipment.freightCost != null ? shipment.freightCost : 0,
        };
      }) : [],

      totalItems: invoice.shipments ? invoice.shipments.length : 0,
      subTotal: invoice.subTotal != null ? invoice.subTotal : 0,
      fuelSurcharge: invoice.fuelSurchargeAmount != null ? invoice.fuelSurchargeAmount : 0,
      deposit: invoice.depositAmount != null ? invoice.depositAmount : 0,
      invoiceTotal: invoice.totalAmount != null ? invoice.totalAmount : 0,

      payableTo: brokerageInfo.payableTo,
      // Using static contact info from brokerageInfo as per Excel example for "If you have questions"
      contactPerson: brokerageInfo.contactPerson || "James Randazzo", // Fallback to Excel example
      contactPhone: brokerageInfo.contactPhone || "3303245421",   // Fallback to Excel example
      contactEmail: brokerageInfo.contactEmail || "JR.leekbrokerage@gmail.com", // Fallback to Excel example
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