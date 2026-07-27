const prisma = require('../prismaClient');

// @desc    Get Admin Financial Overview
// @route   GET /api/finance/stats
// @access  Private/Admin
const getFinanceStats = async (req, res, next) => {
  try {
    // 1. Total Revenue (Sum of all PAID invoices)
    const totalRevenue = await prisma.invoice.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true }
    });

    // 2. Pending Payments (Sum of all PENDING invoices)
    const pendingPayments = await prisma.invoice.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true }
    });

    // 3. Monthly Billing (Total amount of invoices created this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyBilling = await prisma.invoice.aggregate({
      where: {
        createdAt: { gte: startOfMonth }
      },
      _sum: { amount: true }
    });

    // 4. Monthly Paid (Revenue collected this month)
    const monthlyPaid = await prisma.invoice.aggregate({
      where: {
        status: 'PAID',
        updatedAt: { gte: startOfMonth }
      },
      _sum: { amount: true }
    });

    // 5. Total Expenses (Only confirmed payouts)
    const totalExpenses = await prisma.expense.aggregate({
      where: {
        status: { in: ['PAID', 'SENT', 'COMPLETED', 'VERIFIED'] }
      },
      _sum: { amount: true }
    });

    // 6. Recent Transactions
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { client: { include: { user: { select: { firstName: true, lastName: true } } } } }
    });

    res.json({
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingPayments: pendingPayments._sum.amount || 0,
      monthlyBilling: monthlyBilling._sum.amount || 0,
      monthlyPaid: monthlyPaid._sum.amount || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      recentInvoices: recentInvoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client.user.firstName + ' ' + inv.client.user.lastName,
        amount: inv.amount,
        status: inv.status,
        date: inv.createdAt
      }))
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getFinanceStats };
