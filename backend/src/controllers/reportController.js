const Shipment = require('../models/Shipment');
const User = require('../models/User'); // Still needed for createdBy/updatedBy if used
const Driver = require('../models/Driver'); // Import new Driver model
const Invoice = require('../models/Invoice'); // Added Invoice model
const mongoose = require('mongoose');
const { validationResult } = require('express-validator'); // Removed query as it's used in routes
const PDFDocument = require('pdfkit'); // Added PDFKit

// Helper function to format currency
const formatCurrency = (value) => {
  if (value == null || isNaN(parseFloat(value))) {
    return 'N/A'; // Or perhaps an empty string or $0.00
  }
  return `$${parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper function to format phone numbers
const formatPhoneNumber = (phoneNumberString) => {
  if (!phoneNumberString) return 'N/A';
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phoneNumberString; // Return original if not a 10-digit number
};

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
    
    // Find shipments and populate driver and customer details
    const shipments = await Shipment.find(matchConditions)
      .populate({
        path: 'driver', // This now refers to the Driver model due to Shipment model change
        select: 'firstName lastName commissionRate contactPhone contactEmail' // Select fields from Driver model
      })
      .sort({ actualDeliveryDate: 1 });

    if (!shipments || shipments.length === 0) {
      return res.status(200).json({ success: true, message: 'No shipments found matching criteria for commission report.', data: [] });
    }

    const ton = 2000; // 1 ton = 2000 lbs
    const MINIMUM_PAYMENT_WEIGHT = 40000; // As per business logic

    const commissionReport = shipments.filter(shipment => shipment.driver && shipment.driver.commissionRate != null)
      .map((shipment, index) => {
        const actualWeight = shipment.weight || 0;
        const effectiveWeightForPayment = Math.max(actualWeight, MINIMUM_PAYMENT_WEIGHT);
        const commissionBaseAmount = (effectiveWeightForPayment / ton) * shipment.rate;
        
        const commissionAmount = commissionBaseAmount * (shipment.driver.commissionRate || 0);

        const originCity = shipment.origin && shipment.origin.city ? shipment.origin.city : 'N/A';
        const destCity = shipment.destination && shipment.destination.city ? shipment.destination.city : 'N/A';
        const pickupDestCombined = `${originCity} / ${destCity}`;
        
        return {
          date: shipment.actualDeliveryDate || shipment.deliveryDate || shipment.estimatedDeliveryDate, // Prioritize actualDeliveryDate, then deliveryDate
          shippingNumber: shipment.shippingNumber || 'N/A', // Corrected from shipmentId to shippingNumber
          pickupDestination: pickupDestCombined,
          driverName: shipment.driver ? shipment.driver.fullName : 'N/A',
          // driverUsername: shipment.driver ? shipment.driver.username : 'N/A', // username not on Driver model
          truckNumber: shipment.truckNumber || 'N/A',
          price: shipment.rate != null ? parseFloat(shipment.rate.toFixed(4)) : 0,
          weight: actualWeight,
          amount: shipment.freightCost != null ? parseFloat(shipment.freightCost.toFixed(2)) : 0, // This is the freightCost (rate * weight)
          commissionRate: shipment.driver.commissionRate,
          commissionAmount: parseFloat(commissionAmount.toFixed(2))
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
  // Date, Ship#, Pick-up/Dest, Driver, Trk#, Price, Weight, Amount (Freight), Rate (Comm), Commission
  // Adjusted width for Pick-up/Dest from 80 to 100, reduced Driver from 80 to 60 to compensate. Total width remains similar.
  const colWidths = [60, 70, 100, 60, 50, 55, 60, 65, 50, 65];
  let currentX = startX;

  doc.fontSize(9); // Smaller font for table
  const headers = ['Date', 'Shipment #', 'Pick-up/Dest.', 'Driver', 'Trk #', 'Price', 'Weight', 'Amount', 'Comm Rate', 'Commission'];
  
  headers.forEach((header, i) => {
    doc.text(header, currentX, tableTop, {
        width: colWidths[i],
        lineBreak: false,
        align: (i >= 5 ? 'right' : 'left') // Price, Weight, Amount, Comm Rate, Commission right-aligned
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
      item.shippingNumber || 'N/A', // Corrected from item.shipmentId
      item.pickupDestination || 'N/A',
      item.driverName || 'N/A',
      item.truckNumber || 'N/A',
      item.price != null ? formatCurrency(item.price) : 'N/A', // Format Price
      item.weight != null ? item.weight.toLocaleString() : 'N/A', // Weight is not currency
      item.amount != null ? formatCurrency(item.amount) : 'N/A', // Amount (Freight Cost)
      item.commissionRate != null ? (item.commissionRate * 100).toFixed(0) + '%' : 'N/A',
      item.commissionAmount != null ? formatCurrency(item.commissionAmount) : 'N/A' // Commission Amount
    ];

    rowValues.forEach((value, i) => {
      doc.text(value.toString(), currentX, rowY, { width: colWidths[i], lineBreak: false, align: (i >= 5 ? 'right' : 'left') });
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

  // Totals
  const totalsX = doc.page.width - startX - 200; // Adjust X position for totals block
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(`Total Amount (Freight): ${formatCurrency(reportData.totalFreightAmount)}`, totalsX, undefined, { align: 'right', width: 200 });

  doc.text(`Total Commission: ${formatCurrency(reportData.totalCommission)}`, totalsX, undefined, { align: 'right', width: 200 });
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
        totalFreightAmount: commissionReport.reduce((sum, item) => sum + (item.amount || 0), 0),
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

  // Format InvoiceDate for filename (MMDDYY)
  const invoiceDateObj = new Date(reportData.invoiceDate);
  const month = (invoiceDateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = invoiceDateObj.getDate().toString().padStart(2, '0');
  const year = invoiceDateObj.getFullYear().toString().slice(-2); // Get last two digits of year
  const formattedInvoiceDate = `${month}${day}${year}`;

  // Sanitize CustomerName for filename (remove spaces and non-alphanumeric)
  const sanitizedCustomerName = (reportData.billTo || 'UnknownCustomer')
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[^a-zA-Z0-9]/g, ''); // Remove non-alphanumeric characters

  const newFilename = `${sanitizedCustomerName}${formattedInvoiceDate}.pdf`;

  // Set headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${newFilename}`);
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
  // New column order: Date, Shipping #, Pick-up/Dest., Driver, Trk #, Price, Weight, Amount
  // Adjusted width for Pick-up/Dest. from 80 to 100, Driver from 70 to 50.
  const colWidthsConfig = [
    { header: 'Date', width: 60, align: 'left' },
    { header: 'Shipping #', width: 60, align: 'left' },
    { header: 'Pick-up/Dest.', width: 100, align: 'left' },
    { header: 'Driver', width: 50, align: 'left' },
    { header: 'Trk #', width: 35, align: 'left' },
    { header: 'Price', width: 55, align: 'right' }, // New Price column
    { header: 'Weight', width: 55, align: 'right' },
    { header: 'Amount', width: 65, align: 'right' }
  ];
  // Sum of new widths: 60+60+80+70+35+55+55+65 = 480. This fits within 512.

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
        item.pickupDestination || 'N/A',
        item.driver || 'N/A',
        item.truckNumber || 'N/A',
        item.price != null ? `${formatCurrency(item.price)}/ton` : 'N/A', // Display as $X.XX/ton
        item.weight != null ? item.weight.toLocaleString() : 'N/A',
        item.amount != null ? formatCurrency(item.amount) : 'N/A'
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
  doc.text(`Subtotal: ${formatCurrency(reportData.subTotal)}`, totalsX, undefined, { align: 'right' });
  if (reportData.fuelSurchargeRatePercentage != null && reportData.fuelSurcharge != null) {
   doc.text(`Fuel Surcharge ${reportData.fuelSurchargeRatePercentage}% : ${formatCurrency(reportData.fuelSurcharge)}`, totalsX, undefined, { align: 'right' });
  } else if (reportData.fuelSurcharge != null) { // Fallback if rate is not available for some reason
   doc.text(`Fuel Surcharge : ${formatCurrency(reportData.fuelSurcharge)}`, totalsX, undefined, { align: 'right' });
  }
  // Deposit was removed from Invoice model, so this check might be redundant or need adjustment
  // if (reportData.deposit > 0) {
  //   doc.text(`Deposit: ${formatCurrency(reportData.deposit)}`, totalsX, undefined, { align: 'right' });
  // }
  doc.font('Helvetica-Bold').text(`Invoice Total: ${formatCurrency(reportData.invoiceTotal)}`, totalsX, undefined, { align: 'right' });
  doc.font('Helvetica');
  doc.moveDown(2);
 
  const drawFooter = (docInstance, data) => {
    const pageBottomMargin = 50; // Standard margin
    const footerHeightEstimate = 100; // Approximate height needed for footer content
    let footerStartY = docInstance.page.height - pageBottomMargin - footerHeightEstimate;
    if (footerStartY < docInstance.y + 20) { // Ensure footer doesn't overlap content if content is too long
        footerStartY = docInstance.y + 20; // Position it after current content if page is almost full
    }
    if (footerStartY > docInstance.page.height - pageBottomMargin - 20) { // Don't let it go too high if page is short
        footerStartY = docInstance.page.height - pageBottomMargin - footerHeightEstimate;
    }


    // Thick black line above footer
    docInstance.moveTo(startX, footerStartY - 10) // 10 points above the first line of text
       .lineTo(docInstance.page.width - startX, footerStartY - 10)
       .lineWidth(1.5)
       .strokeColor('black')
       .stroke();
    
    const footerTextX = startX; // Use page margins
    const footerWidth = docInstance.page.width - startX * 2;

    docInstance.fontSize(9).font('Helvetica');
    let currentY = footerStartY;

    const lines = [
        "Make all checks payable to: Leek Brokerage Inc",
        "If you have any questions concerning this invoice, contact:",
        `${data.contactPerson} - ${data.contactPhone} - ${data.contactEmail}`,
        data.brokerageAddressLine1,
        data.brokerageAddressLine2,
        `Phone: ${data.brokerageMainPhone}`
    ];

    lines.forEach(line => {
        docInstance.text(line, footerTextX, currentY, { align: 'center', width: footerWidth });
        currentY += docInstance.currentLineHeight() * 0.9; // Adjust spacing
    });
    
    docInstance.moveDown(0.5); // Add a bit more space before the thank you
    currentY = docInstance.y; // Recalculate Y after moveDown
    docInstance.font('Helvetica-Bold').fontSize(10).text("Thank you for your business!", footerTextX, currentY, { align: 'center', width: footerWidth });
    docInstance.font('Helvetica'); // Reset font
  };

  // Draw footer on the first page
  drawFooter(doc, reportData);

  // Register event to draw footer on subsequent pages
  doc.on('pageAdded', () => {
    drawFooter(doc, reportData);
  });

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
        populate: [
          {
            path: 'driver', // This now refers to the Driver model
            select: 'firstName lastName contactPhone' // Select relevant fields from Driver model
          },
          // { path: 'customer', select: 'name' }
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
      mainPhone: "2312148200",
      contactPerson: "James Randazzo", // Added from user request
      contactPhone: "3303245421",   // Added from user request
      contactEmail: "JR.leekbrokerage@gmail.com" // Added from user request
    };

    const reportData = {
      brokerageName: brokerageInfo.name,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.issueDate,
      billTo: invoice.customer && invoice.customer.name ? invoice.customer.name : 'N/A', // Use populated customer.name
      projectDescription: invoice.notes || "N/A",

      shipmentDetails: invoice.shipments ? invoice.shipments.map(shipment => {
        const driverName = shipment.driver ? shipment.driver.fullName : 'N/A'; // Use virtual fullName from Driver model
        const origin = shipment.origin || {};
        const destination = shipment.destination || {};
        const originCity = origin.city || 'N/A';
        const destCity = destination.city || 'N/A';
        const pickupDestCombined = `${originCity} / ${destCity}`;
        // Use the new 'rate' and 'weight' fields from the Shipment model
        
        console.log(`[getInvoiceReport] PDF Data Prep - Shipment: ${shipment.shippingNumber}, Rate: ${shipment.rate}, Weight: ${shipment.weight}, FreightCost: ${shipment.freightCost}`);

        return {
            date: shipment.deliveryDate || shipment.actualPickupDate || shipment.pickupDate, // Prefer deliveryDate
            shippingNumber: shipment.shippingNumber || 'N/A', // Corrected from shipment.shipmentId
            pickupDestination: pickupDestCombined,
            driver: driverName,
            truckNumber: shipment.truckNumber || 'N/A',
            price: shipment.rate != null ? shipment.rate : 0, // New "Price" field from shipment.rate
            weight: shipment.weight != null ? shipment.weight : 0, // New "weight" field
            amount: shipment.freightCost != null ? shipment.freightCost : 0, // This is rate * weight
        };
      }) : [],

      totalItems: invoice.shipments ? invoice.shipments.length : 0,
      subTotal: invoice.subTotal != null ? invoice.subTotal : 0,
      fuelSurcharge: invoice.fuelSurchargeAmount != null ? invoice.fuelSurchargeAmount : 0,
      fuelSurchargeRatePercentage: invoice.fuelSurchargeRate != null ? (invoice.fuelSurchargeRate * 100).toFixed(0) : null, // Added for display
      deposit: invoice.depositAmount != null ? invoice.depositAmount : 0,
      invoiceTotal: invoice.totalAmount != null ? invoice.totalAmount : 0,

      payableTo: brokerageInfo.payableTo,
      contactPerson: brokerageInfo.contactPerson,
      contactPhone: formatPhoneNumber(brokerageInfo.contactPhone),
      contactEmail: brokerageInfo.contactEmail,
      brokerageAddressLine1: brokerageInfo.addressLine1,
      brokerageAddressLine2: brokerageInfo.addressLine2,
      brokerageMainPhone: formatPhoneNumber(brokerageInfo.mainPhone),
      dueUponReceipt: true, // As per Excel
      thankYouMessage: "Thank you for your business!" // This is now part of the structured footer
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