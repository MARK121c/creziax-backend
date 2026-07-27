const PDFDocument = require('pdfkit');
const path = require('path');
const ArabicShaper = require('arabic-persian-reshaper').ArabicShaper;
const bidi = require('bidi-js')();

const BRAND   = '#D4AF37'; // Gold
const DARK    = '#0a0a0c'; // Deep Black
const MID     = '#475569'; // slate-600
const LIGHT   = '#94a3b8'; // slate-400
const LINE    = '#e2e8f0'; // slate-200
const SUCCESS = '#D4AF37'; // Using Gold for success too per theme

// Font paths
const fontPath = path.join(__dirname, '../assets/fonts/Amiri-Regular.ttf');
const fontBoldPath = path.join(__dirname, '../assets/fonts/Amiri-Bold.ttf');

/**
 * Helper to prepare Arabic text for PDFKit (Shaping + Bidi)
 */
const prepareArabic = (text) => {
  if (!text) return '';
  // Check if text contains Arabic characters
  const arabicPattern = /[\u0600-\u06FF]/;
  if (!arabicPattern.test(text)) return text;
  
  try {
    const reshaped = ArabicShaper.convertArabic(text);
    const levels = bidi.getEmbeddingLevels(reshaped);
    return bidi.getReorderedString(reshaped, levels);
  } catch (err) {
    console.error('Arabic reshaping error:', err);
    return text;
  }
};

/**
 * Draw a horizontal rule
 */
const hr = (doc, y, color = LINE) => {
  doc.strokeColor(color).lineWidth(0.75).moveTo(50, y).lineTo(545, y).stroke();
};

/**
 * Generate a High-End Minimalist Invoice PDF for Clients (Limomuv Gold Edition)
 */
const generateInvoicePDF = (invoice, stream) => {
  console.log('Generating PDF for invoice:', JSON.stringify(invoice, null, 2));
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(stream);

  // Register and set font globally
  try {
    doc.registerFont('Arabic', fontPath);
    doc.registerFont('Arabic-Bold', fontBoldPath);
  } catch (err) {
    console.error('Font registration failed:', err);
  }
  
  doc.font('Helvetica'); // Default to Helvetica

  const LEFT_MARGIN = 50;
  const RIGHT_MARGIN = 545;

  // ── HEADER ─────────────────────────────────────────────────────────────
  // Deep Black Header Bar
  doc.rect(0, 0, 595, 120).fill(DARK);
  // Gold Accent Line
  doc.rect(0, 120, 595, 5).fill(BRAND);

  // Logo & Branding
  doc.fillColor('#FFFFFF').fontSize(36).font('Helvetica-Bold').text('LIMOMUV', LEFT_MARGIN, 40);
  doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold').text('WORLD CLASS AGENCY OS', LEFT_MARGIN, 85, { characterSpacing: 2 });

  // "INVOICE" Title
  doc.fillColor('#FFFFFF').fontSize(36).font('Helvetica-Bold').text('INVOICE', 300, 45, { width: 245, align: 'right' });
  
  // Status Stamp (Gold for PAID, Slate for PENDING)
  const isPaid = invoice.status === 'PAID';
  if (isPaid) {
    doc.save();
    doc.rotate(-15, { origin: [450, 160] });
    doc.rect(380, 140, 140, 40).lineWidth(3).strokeColor(BRAND).stroke();
    doc.fillColor(BRAND).fontSize(16).font('Arabic-Bold').text(prepareArabic('PAID / مدفوع'), 380, 152, { width: 140, align: 'center' });
    doc.restore();
  } else {
    doc.rect(380, 150, 165, 25).fill('#f8fafc');
    doc.fillColor(MID).fontSize(10).font('Arabic-Bold').text(prepareArabic('● PENDING / قيد الانتظار'), 383, 158, { width: 159, align: 'center' });
  }

  hr(doc, 200, BRAND);

  // ── BILL TO & META ─────────────────────────────────────────────────────
  const infoY = 230;
  const clientName = prepareArabic(`${invoice.client.user.firstName} ${invoice.client.user.lastName}`);
  
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('BILLED TO', LEFT_MARGIN, infoY);
  doc.fillColor(DARK).fontSize(16).font('Arabic-Bold').text(clientName, LEFT_MARGIN, infoY + 15);

  const metaY = infoY;
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('INVOICE NO.', 380, metaY);
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(invoice.invoiceNumber, 380, metaY + 15, { width: 165, align: 'right' });

  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('DATE', 380, metaY + 40);
  doc.fillColor(DARK).fontSize(11).font('Helvetica').text(new Date(invoice.createdAt).toLocaleDateString('en-GB'), 380, metaY + 55, { width: 165, align: 'right' });

  hr(doc, 310, '#f1f5f9');

  // ── ITEM TABLE ──────────────────────────────────────────────────────────
  const tableY = 340;
  doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold').text('SERVICE DESCRIPTION', LEFT_MARGIN, tableY);
  doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold').text('AMOUNT (USD)', RIGHT_MARGIN - 80, tableY, { width: 80, align: 'right' });

  doc.fillColor(DARK).fontSize(14).font('Arabic-Bold').text(prepareArabic(invoice.service || 'Premium Agency Services'), LEFT_MARGIN, tableY + 25);
  
  const amountStr = invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  doc.fillColor(DARK).fontSize(14).font('Helvetica-Bold').text(`$${amountStr}`, RIGHT_MARGIN - 100, tableY + 25, { width: 100, align: 'right' });

  hr(doc, 400, BRAND);

  // ── TOTAL ───────────────────────────────────────────────────────────────
  doc.fillColor(LIGHT).fontSize(10).font('Helvetica-Bold').text('TOTAL AMOUNT DUE', 380, 425);
  doc.fillColor(DARK).fontSize(28).font('Helvetica-Bold').text(`$${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 380, 445, { width: 165, align: 'right' });

  // ── FOOTER / PAYMENT ───────────────────────────────────────────────────
  const footerY = 580;
  doc.rect(LEFT_MARGIN, footerY, 495, 100).fill('#fafafa');
  doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold').text('PAYMENT INSTRUCTIONS', LEFT_MARGIN + 20, footerY + 15);
  
  let instructions = invoice.paymentDetails || `Please settle this invoice via ${invoice.paymentMethod || 'the usual method'}.`;
  doc.fillColor(DARK).fontSize(10).font('Arabic').text(prepareArabic(instructions), LEFT_MARGIN + 20, footerY + 30, { width: 455 });

  // Final Global Note
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica').text('Thank you for partnering with LIMOMUV.', LEFT_MARGIN, 780, { width: 495, align: 'center' });
  doc.fillColor(BRAND).text('PRECISION • CREATIVITY • SCALE', LEFT_MARGIN, 792, { width: 495, align: 'center', characterSpacing: 1 });

  doc.end();
};

const generateContractPDF = (project, stream) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(stream);

  doc.registerFont('Arabic', fontPath);
  doc.registerFont('Arabic-Bold', fontBoldPath);
  doc.font('Arabic');

  // Gold Header Bar
  doc.rect(0, 0, 595, 100).fill(DARK);
  doc.rect(0, 100, 595, 5).fill(BRAND);

  doc.fillColor('#FFFFFF').fontSize(32).font('Helvetica-Bold').text('LIMOMUV', 50, 30);
  doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold').text('WORLD CLASS AGENCY OS', 50, 70, { characterSpacing: 2 });

  doc.fillColor(DARK).fontSize(28).font('Arabic-Bold').text('SERVICE AGREEMENT', 50, 140, { align: 'center', characterSpacing: 2 });
  doc.fillColor(BRAND).fontSize(10).font('Arabic-Bold').text('O P E R A T I O N A L   M A N D A T E', 50, 175, { align: 'center', characterSpacing: 4 });

  hr(doc, 210, BRAND);

  const clientName = prepareArabic(`${project.client.user.firstName} ${project.client.user.lastName}`);
  const clientCompany = prepareArabic(project.client.company || 'Private Party');

  doc.fillColor(DARK).fontSize(13).font('Arabic').text(`This Binding Professional Service Agreement is established on ${new Date().toLocaleDateString('en-GB')} by:`, 50, 240)
    .moveDown()
    .font('Arabic-Bold').text('THE AGENCY: LIMOMUV CREATIVE OS', 70)
    .font('Arabic-Bold').text(prepareArabic(`THE CLIENT: ${clientName} (${clientCompany})`), 70)
    .moveDown(2);

  doc.font('Arabic-Bold').fontSize(14).fillColor(BRAND).text('1. MISSION SCOPE');
  doc.font('Arabic').fontSize(11).fillColor(DARK).text(prepareArabic(`${project.name}: ${project.description || 'Execution of full-scale video production and strategic content management.'}`), { align: 'justify' });

  doc.moveDown();
  doc.font('Arabic-Bold').fontSize(14).fillColor(BRAND).text('2. OPERATIONAL STANDARDS');
  doc.font('Arabic').fontSize(11).fillColor(DARK).text('LIMOMUV provides world-class execution across all assigned deliverables. Both parties commit to professional excellence and complete confidentiality regarding all proprietary workflows and shared data.', { align: 'justify' });

  doc.moveDown();
  doc.font('Arabic-Bold').fontSize(14).fillColor(BRAND).text('3. DURATION & LEGAL');
  doc.font('Arabic').fontSize(11).fillColor(DARK).text('This agreement remains active for the project duration and is governed by the laws of the operating jurisdiction of LIMOMUV.', { align: 'justify' });

  doc.moveDown(4);

  const sigTop = 680;
  doc.rect(50, sigTop - 30, 200, 1).fill(LINE);
  doc.fillColor(DARK).font('Arabic-Bold').fontSize(10).text('AGENCY DIRECTOR', 50, sigTop);
  doc.fillColor(BRAND).text('LIMOMUV EXECUTIVE TEAM', 50, sigTop + 15);

  doc.rect(345, sigTop - 30, 200, 1).fill(LINE);
  doc.fillColor(DARK).font('Arabic-Bold').fontSize(10).text('CLIENT AUTHORIZATION', 345, sigTop);
  doc.fillColor(BRAND).text(clientName, 345, sigTop + 15);

  doc.end();
};

/**
 * Generate a Team Payment Voucher (Limomuv Gold Edition)
 */
const generateTeamDuePDF = (expense, stream) => {
  console.log('Generating PDF for team due:', JSON.stringify(expense, null, 2));
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(stream);
  
  try {
    doc.registerFont('Arabic', fontPath);
    doc.registerFont('Arabic-Bold', fontBoldPath);
  } catch (err) {
    console.error('Font registration failed:', err);
  }
  doc.font('Helvetica');

  const LEFT_MARGIN = 50;

  // Gold Sidebar Accent
  doc.rect(0, 0, 15, 842).fill(BRAND);

  // ── HEADER ─────────────────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(24).font('Helvetica-Bold').text('LIMOMUV', LEFT_MARGIN, 50);
  doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold').text('INTERNAL PRODUCTION SETTLEMENT', LEFT_MARGIN, 78, { characterSpacing: 1 });

  // "PAYMENT VOUCHER" Title
  doc.fillColor(DARK).fontSize(26).font('Helvetica-Bold').text('PAYMENT VOUCHER', 230, 45, { width: 315, align: 'right' });
  doc.fillColor(BRAND).fontSize(10).font('Arabic').text(prepareArabic('سند صرف مالي لتشغيل المحتوى'), 230, 75, { width: 315, align: 'right' });

  // Status Stamp
  const isSent = expense.status === 'SENT';
  if (isSent) {
    doc.save();
    doc.rotate(-15, { origin: [450, 120] });
    doc.rect(380, 100, 140, 40).lineWidth(3).strokeColor(BRAND).stroke();
    doc.fillColor(BRAND).fontSize(16).font('Arabic-Bold').text(prepareArabic('SENT / تم الإرسال'), 380, 112, { width: 140, align: 'center' });
    doc.restore();
  } else {
    doc.rect(380, 100, 165, 25).fill('#f8fafc');
    doc.fillColor(MID).fontSize(10).font('Arabic-Bold').text(prepareArabic('● PENDING / قيد المعالجة'), 383, 108, { width: 159, align: 'center' });
  }

  hr(doc, 160, BRAND);

  // ── PAID TO & META ─────────────────────────────────────────────────────
  const infoY = 190;
  const memberName = expense.user ? prepareArabic(`${expense.user.firstName} ${expense.user.lastName}`) : 'N/A';

  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('BENEFICIARY', LEFT_MARGIN, infoY);
  doc.fillColor(DARK).fontSize(16).font('Arabic-Bold').text(memberName, LEFT_MARGIN, infoY + 15);

  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('VOUCHER NO.', 380, infoY);
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(`#V-${expense.id ? expense.id.slice(0, 8).toUpperCase() : 'N/A'}`, 380, infoY + 15, { width: 165, align: 'right' });

  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('ISSUED DATE', 380, infoY + 40);
  doc.fillColor(DARK).fontSize(11).font('Helvetica').text(new Date(expense.createdAt).toLocaleDateString('en-GB'), 380, infoY + 55, { width: 165, align: 'right' });

  hr(doc, 270, '#f1f5f9');

  // ── DETAILS ─────────────────────────────────────────────────────────────
  const tableY = 300;
  doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold').text(prepareArabic('PRODUCTION DESCRIPTION / بيان التشغيل'), LEFT_MARGIN, tableY);
  doc.fillColor(DARK).fontSize(12).font('Arabic-Bold').text(prepareArabic(expense.description || 'Professional Services'), LEFT_MARGIN, tableY + 20, { width: 300 });

  doc.fillColor(BRAND).fontSize(8).font('Helvetica-Bold').text('TRANSFER METHOD', 380, tableY);
  doc.fillColor(DARK).fontSize(12).font('Arabic-Bold').text(prepareArabic(expense.transferMethod || 'Manual'), 380, tableY + 20, { width: 165, align: 'right' });

  hr(doc, 360, BRAND);

  // ── AMOUNT ─────────────────────────────────────────────────────────────
  doc.fillColor(LIGHT).fontSize(10).font('Helvetica-Bold').text('VOUCHER SETTLEMENT (USD)', 380, 385);
  doc.fillColor(DARK).fontSize(28).font('Helvetica-Bold').text(`$${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 380, 405, { width: 165, align: 'right' });

  // Bottom Accent
  doc.fillColor(LIGHT).fontSize(7).font('Helvetica').text('Confidential internal document generated by LIMOMUV Agency OS.', LEFT_MARGIN, 810, { width: 495, align: 'center' });

  doc.end();
};

module.exports = { generateInvoicePDF, generateContractPDF, generateTeamDuePDF };
