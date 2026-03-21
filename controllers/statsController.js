const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get aggregated stats for the dashboard v2.0 — Phase V5.3 Finance Integration
exports.getDashboardStats = async (req, res) => {
  try {
    const { month } = req.query;
    let dateFilter = {};
    if (month && month !== 'all') {
      const [year, monthNum] = month.split('-');
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);
      dateFilter = {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      };
    }

    // 1. User counts
    const clientsCount = await prisma.user.count({ where: { role: 'CLIENT', ...dateFilter } });
    const teamCount    = await prisma.user.count({ where: { role: 'TEAM', ...dateFilter } });
    const adminsCount  = await prisma.user.count({ where: { role: { in: ['ADMIN', 'OWNER'] }, ...dateFilter } });

    // 2. Active Projects
    const activeProjectsCount = await prisma.project.count({
      where: { status: { not: 'COMPLETED' }, ...dateFilter }
    });

    // 3. Total Tasks
    const totalTasksCount = await prisma.task.count({ where: dateFilter });

    // 4. Managed Channels
    // The user wants EVERYTHING dynamically filtered by the selected month.
    const clientsData = await prisma.client.findMany({ select: { managedChannels: true }, where: dateFilter });
    const totalManagedChannels = clientsData.reduce((acc, curr) => acc + (curr.managedChannels || 0), 0);

    // ------- CLIENT INVOICES (Collection) -------

    // Count all invoices & pending
    const invoicesTotal   = await prisma.invoice.count({ where: dateFilter });
    const invoicesPending = await prisma.invoice.count({ where: { status: 'PENDING', ...dateFilter } });
    const invoicesPaid    = await prisma.invoice.count({ where: { status: 'PAID', ...dateFilter } });

    // Gross Revenue — sum of ALL PAID client invoices
    const paidInvoicesData = await prisma.invoice.findMany({
      where: { status: 'PAID', ...dateFilter },
      select: { amount: true }
    });
    const grossRevenue = paidInvoicesData.reduce((sum, inv) => sum + inv.amount, 0);

    // Pending revenue — invoices not yet paid
    const pendingInvoicesData = await prisma.invoice.findMany({
      where: { status: 'PENDING', ...dateFilter },
      select: { amount: true }
    });
    const pendingRevenue = pendingInvoicesData.reduce((sum, inv) => sum + inv.amount, 0);

    // ------- EXPENSES BREAKDOWN -------

    // Team Dues — Expenses with category = 'TEAM_DUE'
    const teamDuesData = await prisma.expense.findMany({
      where: { category: 'TEAM_DUE', ...dateFilter },
      select: { amount: true }
    });
    const totalTeamDues = teamDuesData.reduce((sum, e) => sum + e.amount, 0);

    // Operational Expenses — all OTHER expenses (not TEAM_DUE)
    const operationalExpensesData = await prisma.expense.findMany({
      where: { category: { not: 'TEAM_DUE' }, ...dateFilter },
      select: { amount: true }
    });
    const totalOperationalExpenses = operationalExpensesData.reduce((sum, e) => sum + e.amount, 0);

    // Team Salaries — Users record salaries manually as TEAM_DUE expenses, 
    // so we skip summing assumed monthly salaries to prevent dummy recurring $270 data.
    const totalSalaries = 0;

    // Bonuses — from Bonus table
    const allBonusesData = await prisma.bonus.findMany({ 
      where: dateFilter,
      select: { amount: true } 
    });
    const totalBonuses = allBonusesData.reduce((sum, b) => sum + b.amount, 0);

    // Total Expenses = salaries + bonuses + team dues + operational
    const totalExpenses = totalSalaries + totalBonuses + totalTeamDues + totalOperationalExpenses;

    // Net Profit = Gross Revenue - Total Expenses
    const netProfit = grossRevenue - totalExpenses;

    res.json({
      users: {
        clients: clientsCount,
        team: teamCount,
        admins: adminsCount
      },
      projects: {
        active: activeProjectsCount
      },
      tasks: {
        total: totalTasksCount
      },
      channels: {
        total: totalManagedChannels
      },
      invoices: {
        total: invoicesTotal,
        pending: invoicesPending,
        paid: invoicesPaid,
        pendingRevenue
      },
      financials: {
        // Main 3 cards
        grossRevenue,
        totalExpenses,
        netProfit,
        pendingRevenue,
        // Breakdown 4 cards
        salaries: totalSalaries,
        teamDues: totalTeamDues,
        operationalExpenses: totalOperationalExpenses,
        bonuses: totalBonuses
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
