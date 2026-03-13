const prisma = require('../prismaClient');

// @desc    Get payments for an invoice
// @route   GET /api/payments?invoiceId=xxx
// @access  Private
const getPayments = async (req, res, next) => {
  try {
    const { invoiceId } = req.query;
    const where = invoiceId ? { invoiceId } : {};
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
      },
    });

    // Auto-update invoice status to PAID
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID' },
    });

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a payment
// @route   DELETE /api/payments/:id
// @access  Private/Admin
const deletePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.payment.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { getPayments, createPayment, deletePayment };
