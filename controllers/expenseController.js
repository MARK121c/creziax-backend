const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateTeamDuePDF } = require('../services/pdfService');

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
      }
    });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching expenses' });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { amount, category, description, transferMethod, transferDetails, userId } = req.body;
    const expense = await prisma.expense.create({
      data: { 
        amount: parseFloat(amount), 
        category, 
        description, 
        transferMethod,
        transferDetails,
        userId: userId || null
      }
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: 'CREATE',
        entityType: 'EXPENSE',
        entityId: expense.id,
        details: JSON.stringify({ amount, category }),
        userId: req.user.userId
      }
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Error creating expense' });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await prisma.expense.delete({ where: { id: req.params.id } });

    await prisma.activityLog.create({
      data: {
        action: 'DELETE',
        entityType: 'EXPENSE',
        entityId: expense.id,
        details: JSON.stringify({ amount: expense.amount }),
        userId: req.user.userId
      }
    });

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting expense' });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const { status, transferMethod, transferDetails } = req.body;
    const data = {};
    if (status) data.status = status;
    if (transferMethod !== undefined) data.transferMethod = transferMethod;
    if (transferDetails !== undefined) data.transferDetails = transferDetails;

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data
    });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Error updating expense' });
  }
};

exports.downloadExpensePDF = async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } }
      }
    });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="TeamDue-${expense.id.slice(0, 8)}.pdf"`);
    generateTeamDuePDF(expense, res);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Error generating PDF' });
  }
};
