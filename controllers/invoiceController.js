const prisma = require('../prismaClient');

// @desc    Get all invoices (admin) or client invoices
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res, next) => {
  try {
    let where = {};

    // If the user is a CLIENT, only show their invoices
    if (req.user.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user.id } });
      if (!client) return res.status(404).json({ message: 'Client record not found' });
      where = { clientId: client.id };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { client: { include: { user: { select: { firstName: true, lastName: true, email: true } } } }, payments: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
const getInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: { include: { user: { select: { firstName: true, lastName: true, email: true } } } }, payments: true },
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
};

// @desc    Create invoice
// @route   POST /api/invoices
// @access  Private/Admin
const createInvoice = async (req, res, next) => {
  try {
    const { clientId, service, amount, dueDate, invoiceNumber } = req.body;

    if (!clientId || !service || !amount || !invoiceNumber) {
      return res.status(400).json({ message: 'Please provide clientId, invoiceNumber, service, and amount' });
    }

    const invoice = await prisma.invoice.create({
      data: { invoiceNumber, service, amount: parseFloat(amount), clientId, dueDate: dueDate ? new Date(dueDate) : null },
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
};

// @desc    Update invoice status
// @route   PUT /api/invoices/:id
// @access  Private/Admin
const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, service, amount, dueDate } = req.body;
    const data = {};
    if (status) data.status = status;
    if (service) data.service = service;
    if (amount) data.amount = parseFloat(amount);
    if (dueDate) data.dueDate = new Date(dueDate);

    const invoice = await prisma.invoice.update({ where: { id }, data });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
};

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private/Admin
const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.invoice.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice };
