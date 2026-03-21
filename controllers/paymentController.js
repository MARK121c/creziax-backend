const prisma = require('../prismaClient');

// @desc    Get payments for an invoice
// @route   GET /api/payments?invoiceId=xxx
// @access  Private
const getPayments = async (req, res, next) => {
  try {
    const { invoiceId } = req.query;
    let where = invoiceId ? { invoiceId } : {};

    if (req.user.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user.id } });
      if (!client) return res.status(404).json({ message: 'Client record not found' });
      where = { ...where, invoice: { clientId: client.id } };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { invoice: true },
      orderBy: { paymentDate: 'desc' },
    });
    res.json(payments);
  } catch (err) {
    next(err);
  }
};

// @desc    Record a payment
// @route   POST /api/payments
// @access  Private/Admin
const createPayment = async (req, res, next) => {
  try {
    const { invoiceId, amount, method, transactionId } = req.body;

    if (!invoiceId || !amount) {
      return res.status(400).json({ message: 'invoiceId and amount are required' });
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount: parseFloat(amount),
        method: method || 'MANUAL',
        transactionId: transactionId || null,
        status: req.user.role === 'CLIENT' ? 'PENDING' : 'VERIFIED'
      },
      include: { invoice: { include: { client: { include: { user: true } } } } }
    });

    // Notify OWNER if client records a payment
    if (req.user.role === 'CLIENT') {
      const { sendEmail } = require('../services/emailService');
      const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
      if (owner) {
        sendEmail(
          owner.email, 
          'إشعار دفع جديد - Creziax', 
          `العميل ${payment.invoice.client.user.firstName} قام بتسجيل دفعة بمبلغ $${amount}`,
          `<div style="font-family: sans-serif;">
            <h2 style="color: #4f46e5;">إشعار دفع جديد</h2>
            <p>العميل: <strong>${payment.invoice.client.user.firstName} ${payment.invoice.client.user.lastName}</strong></p>
            <p>المبلغ: <strong>$${amount}</strong></p>
            <p>رقم الفاتورة: <strong>${payment.invoice.invoiceNumber}</strong></p>
            <p>المرجع: <strong>${transactionId || 'N/A'}</strong></p>
            <hr/>
            <p>يرجى مراجعة بوابة الدفع والتأكيد.</p>
          </div>`
        ).catch(err => console.error('Email alert failed:', err));
      }
    }

    // Auto-update invoice status to PAID only if verified
    if (payment.status === 'VERIFIED') {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' },
      });
    }

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
};

// @desc    Verify a payment
// @route   PUT /api/payments/:id/verify
// @access  Private/Owner
const verifyPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // VERIFIED or REJECTED

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const payment = await prisma.payment.update({
      where: { id },
      data: { status },
      include: { invoice: { include: { client: { include: { user: true } } } } }
    });

    if (status === 'VERIFIED') {
      await prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'PAID' }
      });

      // Send confirmation email to client
      const { sendEmail } = require('../services/emailService');
      sendEmail(
        payment.invoice.client.user.email,
        'تم تأكيد عملية الدفع - Creziax',
        `عزيزي ${payment.invoice.client.user.firstName}، تم تأكيد استلام دفعتك بنجاح.`,
        `<div style="font-family: sans-serif;">
          <h2 style="color: #4f46e5;">تأكيد استلام الدفع</h2>
          <p>عزيزي <strong>${payment.invoice.client.user.firstName}</strong>،</p>
          <p>تم تأكيد استلام دفعتك بقيمة <strong>$${payment.amount}</strong> للفاتورة رقم <strong>${payment.invoice.invoiceNumber}</strong>.</p>
          <p>شكراً لتعاملكم معنا.</p>
        </div>`
      ).catch(err => console.error('Confirmation email failed:', err));
    }

    res.json(payment);
  } catch (err) {
    next(err);
  }
};

module.exports = { getPayments, createPayment, verifyPayment };
