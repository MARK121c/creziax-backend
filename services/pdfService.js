const PDFDocument = require('pdfkit');
const path = require('path');
const ArabicShaper = require('arabic-persian-reshaper').ArabicShaper;
const bidi = require('bidi-js')();

const BRAND   = '#4f46e5'; // indigo-600
const DARK    = '#0f172a'; // slate-900
const MID     = '#475569'; // slate-600
const LIGHT   = '#94a3b8'; // slate-400
const LINE    = '#e2e8f0'; // slate-200
const SUCCESS = '#059669'; // emerald-600

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
 * Generate a High-End Minimalist Invoice PDF for Clients
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

  const PAGE_W = 595;
  const LEFT_MARGIN = 50;
  const RIGHT_MARGIN = 545;

  // ── HEADER ─────────────────────────────────────────────────────────────
  // Logo placeholder or text
  doc.fillColor(DARK).fontSize(24).font('Helvetica-Bold').text('CREZIAX', LEFT_MARGIN, 50);
  doc.fillColor(LIGHT).fontSize(9).font('Helvetica').text('CREATIVE AGENCY', LEFT_MARGIN, 78);

  // "INVOICE" Title
  doc.fillColor(DARK).fontSize(32).font('Helvetica-Bold').text('INVOICE', 300, 45, { width: 245, align: 'right' });
  
  // Status Stamp (Green for PAID, Yellow for PENDING)
  const isPaid = invoice.status === 'PAID';
  if (isPaid) {
    // PAID STAMP (Green)
    doc.save();
    doc.rotate(-15, { origin: [450, 120] });
    doc.rect(380, 100, 140, 40).lineWidth(3).strokeColor('#10b981').stroke();
    doc.fillColor('#10b981').fontSize(16).font('Arabic-Bold').text(prepareArabic('PAID / مدفوع'), 380, 112, { width: 140, align: 'center' });
    doc.restore();
  } else {
    // PENDING BADGE (Yellow)
    doc.rect(380, 100, 165, 25).fill('#fef3c7');
    doc.fillColor('#92400e').fontSize(10).font('Arabic-Bold').text(prepareArabic('● PENDING / قيد الانتظار'), 383, 108, { width: 159, align: 'center' });
  }

  hr(doc, 160);

  // ── BILL TO & META ─────────────────────────────────────────────────────
  const infoY = 180;
  const clientName = prepareArabic(`${invoice.client.user.firstName} ${invoice.client.user.lastName}`);
  
  // Billed To (Name ONLY)
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('BILLED TO', LEFT_MARGIN, infoY);
  doc.fillColor(DARK).fontSize(14).font('Arabic-Bold').text(clientName, LEFT_MARGIN, infoY + 15);

  // Meta Info
  const metaY = infoY;
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('INVOICE NO.', 380, metaY);
  doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(invoice.invoiceNumber, 380, metaY + 15, { width: 165, align: 'right' });

  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('DATE', 380, metaY + 40);
  doc.fillColor(DARK).fontSize(10).font('Helvetica').text(new Date(invoice.createdAt).toLocaleDateString('en-GB'), 380, metaY + 55, { width: 165, align: 'right' });

  hr(doc, 260);

  // ── ITEM TABLE ──────────────────────────────────────────────────────────
  const tableY = 290;
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('SERVICE TYPE', LEFT_MARGIN, tableY);
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('AMOUNT', RIGHT_MARGIN - 60, tableY, { width: 60, align: 'right' });

  doc.fillColor(DARK).fontSize(12).font('Arabic-Bold').text(prepareArabic(invoice.service || 'Creative Services'), LEFT_MARGIN, tableY + 25);
  
  const amountStr = invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  doc.fillColor(DARK).fontSize(12).font('Helvetica-Bold').text(`$${amountStr}`, RIGHT_MARGIN - 100, tableY + 25, { width: 100, align: 'right' });

  if (invoice.currency && invoice.currency !== 'USD' && invoice.exchangeRate && invoice.exchangeRate > 1) {
    const localAmount = (invoice.amount * invoice.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2 });
    doc.fillColor(MID).fontSize(9).font('Arabic').text(prepareArabic(`Equiv: ${localAmount} ${invoice.currency}`), RIGHT_MARGIN - 150, tableY + 45, { width: 150, align: 'right' });
  }

  hr(doc, 350);

  // ── TOTAL ───────────────────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text('TOTAL AMOUNT (USD)', 380, 375);
  doc.fillColor(BRAND).fontSize(24).font('Helvetica-Bold').text(`$${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 380, 395, { width: 165, align: 'right' });

  if (invoice.currency && invoice.currency !== 'USD' && invoice.exchangeRate && invoice.exchangeRate > 1) {
    const localTotal = (invoice.amount * invoice.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2 });
    doc.fillColor(MID).fontSize(12).font('Arabic-Bold').text(prepareArabic(`Total: ${localTotal} ${invoice.currency}`), 380, 430, { width: 165, align: 'right' });
  }

  // ── FOOTER / PAYMENT ───────────────────────────────────────────────────
  if (invoice.paymentMethod || invoice.paymentDetails) {
    const footerY = 550;
    hr(doc, footerY);
    doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('PAYMENT INSTRUCTIONS', LEFT_MARGIN, footerY + 20);
    
    let instructions = `Please send the payment to:`;
    if (invoice.paymentDetails) {
      instructions = invoice.paymentDetails;
    } else if (invoice.paymentMethod) {
      instructions = `Please pay via ${invoice.paymentMethod}`;
    }

    doc.fillColor(DARK).fontSize(10).font('Arabic').text(prepareArabic(instructions), LEFT_MARGIN, footerY + 35, { width: 495 });
  }

  // Final Note
  doc.fillColor(LIGHT).fontSize(7).font('Helvetica').text('Thank you for choosing Creziax Agency.', LEFT_MARGIN, 780, { width: 495, align: 'center' });
  doc.text('This is an electronic document and does not require a physical signature.', LEFT_MARGIN, 792, { width: 495, align: 'center' });

  doc.end();
};

const generateHr = (doc, y) => hr(doc, y);

const generateContractPDF = (project, stream) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(stream);

  // Register font
  doc.registerFont('Arabic', fontPath);
  doc.registerFont('Arabic-Bold', fontBoldPath);
  doc.font('Arabic');

  doc
    .fillColor(DARK)
    .fontSize(24)
    .font('Arabic-Bold')
    .text('CREZIAX', 50, 50)
    .moveDown();

  doc
    .fillColor(BRAND)
    .fontSize(26)
    .font('Arabic-Bold')
    .text('SERVICE AGREEMENT', 50, 150, { align: 'center' });

  hr(doc, 200);

  const clientName = prepareArabic(`${project.client.user.firstName} ${project.client.user.lastName}`);
  const clientCompany = prepareArabic(project.client.company || 'Private Party');

  doc
    .fillColor('#334155')
    .fontSize(12)
    .font('Arabic')
    .text(`This Professional Service Agreement is entered into on ${new Date().toLocaleDateString()} by and between:`, 50, 240)
    .moveDown()
    .font('Arabic-Bold').text('The Agency: CREZIAX DIGITAL LIMITED', 70)
    .font('Arabic-Bold').text(prepareArabic(`The Client: ${clientName} (${clientCompany})`), 70)
    .moveDown(2);

  doc.font('Arabic-Bold').fontSize(14).text('1. PROJECT SUMMARY');
  doc.font('Arabic').fontSize(11).text(prepareArabic(`${project.name}: ${project.description || 'Comprehensive agency support and content management services.'}`), { align: 'justify' });

  doc.moveDown();
  doc.font('Arabic-Bold').fontSize(14).text('2. TERMS OF SERVICE');
  doc.font('Arabic').fontSize(11).text('The Agency agrees to provide all creative and management services to high industry standards. Both parties agree to maintain strict confidentiality regarding all proprietary methods and project materials shared during the term of this engagement.', { align: 'justify' });

  doc.moveDown();
  doc.font('Arabic-Bold').fontSize(14).text('3. GOVERNING LAW');
  doc.font('Arabic').fontSize(11).text('This agreement shall be governed and interpreted under the laws of the jurisdiction where the Agency is headquartered.', { align: 'justify' });

  doc.moveDown(4);

  const sigTop = 650;
  doc.text('__________________________', 50, sigTop);
  doc.font('Arabic-Bold').text('Agency Director', 50, sigTop + 15);
  doc.text('Creziax Solutions', 50, sigTop + 30);

  doc.text('__________________________', 350, sigTop);
  doc.font('Arabic-Bold').text('Client Signature', 350, sigTop + 15);
  doc.text(clientName, 350, sigTop + 30);

  doc.end();
};

/**
 * Generate a Team Payment Voucher (Internal Document)
 */
const generateTeamDuePDF = (expense, stream) => {
  console.log('Generating PDF for team due:', JSON.stringify(expense, null, 2));
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(stream);
  
  // Register font
  try {
    doc.registerFont('Arabic', fontPath);
    doc.registerFont('Arabic-Bold', fontBoldPath);
  } catch (err) {
    console.error('Font registration failed:', err);
  }
  doc.font('Helvetica');

  const LEFT_MARGIN = 50;

  // ── HEADER ─────────────────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(24).font('Helvetica-Bold').text('CREZIAX', LEFT_MARGIN, 50);
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica').text('INTERNAL FINANCIAL VOUCHER', LEFT_MARGIN, 78);

  // "PAYMENT VOUCHER" Title
  doc.fillColor('#f59e0b').fontSize(26).font('Helvetica-Bold').text('PAYMENT VOUCHER', 230, 45, { width: 315, align: 'right' });
  doc.fillColor(LIGHT).fontSize(10).font('Arabic').text(prepareArabic('سند صرف مالي'), 230, 75, { width: 315, align: 'right' });

  // Status Stamp
  const isSent = expense.status === 'SENT';
  if (isSent) {
    // SENT STAMP (Green)
    doc.save();
    doc.rotate(-15, { origin: [450, 120] });
    doc.rect(380, 100, 140, 40).lineWidth(3).strokeColor('#10b981').stroke();
    doc.fillColor('#10b981').fontSize(16).font('Arabic-Bold').text(prepareArabic('SENT / تم الإرسال'), 380, 112, { width: 140, align: 'center' });
    doc.restore();
  } else {
    // PENDING BADGE (Yellow)
    doc.rect(380, 100, 165, 25).fill('#fef3c7');
    doc.fillColor('#92400e').fontSize(10).font('Arabic-Bold').text(prepareArabic('● PENDING / قيد المعالجة'), 383, 108, { width: 159, align: 'center' });
  }

  hr(doc, 260);

  // ── PAID TO & META ─────────────────────────────────────────────────────
  const infoY = 180;
  const memberName = expense.user ? prepareArabic(`${expense.user.firstName} ${expense.user.lastName}`) : 'N/A';

  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('PAID TO (BENEFICIARY)', LEFT_MARGIN, infoY);
  doc.fillColor(DARK).fontSize(14).font('Arabic-Bold').text(memberName, LEFT_MARGIN, infoY + 15);

  // Meta Info
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('VOUCHER NO.', 380, infoY);
  doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(`#V-${expense.id ? expense.id.slice(0, 8).toUpperCase() : 'N/A'}`, 380, infoY + 15, { width: 165, align: 'right' });

  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('ISSUED DATE', 380, infoY + 40);
  doc.fillColor(DARK).fontSize(10).font('Helvetica').text(new Date(expense.createdAt).toLocaleDateString('en-GB'), 380, infoY + 55, { width: 165, align: 'right' });

  hr(doc, 260);

  // ── DETAILS ─────────────────────────────────────────────────────────────
  const tableY = 290;
  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text(prepareArabic('DESCRIPTION / بيان الصرف'), LEFT_MARGIN, tableY);
  doc.fillColor(DARK).fontSize(11).font('Arabic-Bold').text(prepareArabic(expense.description || 'Professional Services'), LEFT_MARGIN, tableY + 20, { width: 300 });

  doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('TRANSFER METHOD', 380, tableY);
  doc.fillColor(DARK).fontSize(11).font('Arabic-Bold').text(prepareArabic(expense.transferMethod || 'Manual'), 380, tableY + 20, { width: 165, align: 'right' });

  hr(doc, 350);

  // ── AMOUNT ─────────────────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text('VOUCHER AMOUNT', 380, 375);
  doc.fillColor('#f59e0b').fontSize(26).font('Helvetica-Bold').text(`$${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 380, 395, { width: 165, align: 'right' });

  // ── TRANSFER DETAILS ───────────────────────────────────────────────────
  if (expense.transferDetails) {
    const footerY = 550;
    hr(doc, footerY);
    doc.fillColor(LIGHT).fontSize(8).font('Helvetica-Bold').text('TRANSFER CONFIRMATION', LEFT_MARGIN, footerY + 20);
    doc.fillColor(DARK).fontSize(10).font('Arabic').text(prepareArabic(expense.transferDetails), LEFT_MARGIN, footerY + 35, { width: 495 });
  }

  // Bottom Accent
  doc.fillColor(LIGHT).fontSize(7).font('Helvetica').text('Confidential internal document generated by Creziax Portal.', LEFT_MARGIN, 800, { width: 495, align: 'center' });

  doc.end();
};

module.exports = { generateInvoicePDF, generateContractPDF, generateTeamDuePDF };
