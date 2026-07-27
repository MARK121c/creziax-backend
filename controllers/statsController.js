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
    const clientsData = await prisma.client.findMany({ select: { managedChannels: true }, where: dateFilter });
    const totalManagedChannels = clientsData.reduce((acc, curr) => acc + (curr.managedChannels || 0), 0);

    // ------- UNIFIED LEDGER (v20.6) -------
    const ledgerInvoices = await prisma.invoice.findMany({
      where: dateFilter,
      include: { client: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: 'desc' }
    });

    const ledgerExpenses = await prisma.expense.findMany({
      where: dateFilter,
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const ledgerBonuses = await prisma.bonus.findMany({
      where: dateFilter,
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const unifiedLedger = [
      ...ledgerInvoices.map(inv => ({
        id: inv.id,
        type: inv.status === 'PAID' ? 'INCOME' : 'PENDING_INCOME',
        amount: inv.amount,
        status: inv.status,
        label: `Invoice #${inv.invoiceNumber}`,
        entity: inv.client?.user ? `${inv.client.user.firstName} ${inv.client.user.lastName}` : '---',
        createdAt: inv.createdAt
      })),
      ...ledgerExpenses.map(exp => ({
        id: exp.id,
        type: 'EXPENSE',
        amount: exp.amount,
        status: (exp.status === 'SENT' || exp.status === 'PAID') ? 'PAID' : 'PENDING',
        label: exp.description || 'مصروف إداري',
        entity: exp.user ? `${exp.user.firstName} ${exp.user.lastName}` : '---',
        createdAt: exp.createdAt
      })),
      ...ledgerBonuses.map(bn => ({
        id: bn.id,
        type: 'BONUS',
        amount: bn.amount,
        status: 'PAID',
        label: bn.reason || 'مكافأة أداء',
        entity: bn.user ? `${bn.user.firstName} ${bn.user.lastName}` : '---',
        createdAt: bn.createdAt
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 5. Invoices Stats
    const allInvoices = await prisma.invoice.findMany({ where: dateFilter });
    const invoicesTotal = allInvoices.length;
    const invoicesPending = allInvoices.filter(i => i.status === 'PENDING').length;
    const invoicesPaid = allInvoices.filter(i => i.status === 'PAID').length;

    const paidInvoicesData = allInvoices.filter(i => i.status === 'PAID');
    const pendingInvoicesData = allInvoices.filter(i => i.status === 'PENDING');

    const grossRevenue = paidInvoicesData.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const pendingRevenue = pendingInvoicesData.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    // 6. Expenses & Bonuses Stats
    const confirmedStatuses = ['PAID', 'SENT', 'COMPLETED', 'VERIFIED'];
    
    const salariesData = await prisma.expense.findMany({ 
      where: { 
        category: 'SALARY', 
        status: { in: confirmedStatuses },
        ...dateFilter 
      } 
    });
    const teamDuesData = await prisma.expense.findMany({ 
      where: { 
        category: 'TEAM_DUE', 
        status: { in: confirmedStatuses },
        ...dateFilter 
      } 
    });
    const operationalData = await prisma.expense.findMany({ 
      where: { 
        category: { notIn: ['SALARY', 'TEAM_DUE'] }, 
        status: { in: confirmedStatuses },
        ...dateFilter 
      } 
    });
    const bonusesData = await prisma.bonus.findMany({ where: dateFilter });

    const totalSalaries = salariesData.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalTeamDues = teamDuesData.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalOperationalExpenses = operationalData.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalBonuses = bonusesData.reduce((sum, b) => sum + (b.amount || 0), 0);

    const totalExpenses = totalSalaries + totalBonuses + totalTeamDues + totalOperationalExpenses;
    const netProfit = grossRevenue - totalExpenses;

    // --- SECURITY FILTERING (v20.7) ---
    const userRole = req.user.role;
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { permissions: true } });
    const userPermissions = dbUser?.permissions || [];
    const hasFinancialAccess = userRole === 'OWNER' || userPermissions.includes('FINANCIAL_ACCESS') || userPermissions.includes('FINANCES');

    if (!hasFinancialAccess) {
      return res.json({
        users: { clients: clientsCount, team: teamCount, admins: adminsCount },
        projects: { active: activeProjectsCount },
        tasks: { total: totalTasksCount },
        channels: { total: totalManagedChannels },
        invoices: { total: 0, pending: 0, paid: 0, pendingRevenue: 0 },
        financials: { grossRevenue: 0, totalExpenses: 0, netProfit: 0, pendingRevenue: 0, salaries: 0, teamDues: 0, operationalExpenses: 0, bonuses: 0 },
        ledger: []
      });
    }

    res.json({
      users: { clients: clientsCount, team: teamCount, admins: adminsCount },
      projects: { active: activeProjectsCount },
      tasks: { total: totalTasksCount },
      channels: { total: totalManagedChannels },
      invoices: { total: invoicesTotal, pending: invoicesPending, paid: invoicesPaid, pendingRevenue },
      financials: { grossRevenue, totalExpenses, netProfit, pendingRevenue, salaries: totalSalaries, teamDues: totalTeamDues, operationalExpenses: totalOperationalExpenses, bonuses: totalBonuses },
      ledger: unifiedLedger
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// v20.0 SUPREME: Team-Specific Dashboard Stats (Protected: TEAM role only)
// GET /api/stats/team-dashboard
// ─────────────────────────────────────────────────────────────────────────────
exports.getTeamDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get the actual TeamMember ID for task lookups
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: userId }
    });
    const memberId = teamMember ? teamMember.id : null;

    // 1. Projects assigned to this team member (via tasks OR direct assignment)
    let assignedProjects = [];
    let assignedTasks = [];
    if (memberId) {
      assignedProjects = await prisma.project.findMany({
        where: {
          OR: [
            { tasks: { some: { assignedToId: memberId } } },
            { teamMembers: { some: { id: memberId } } }
          ]
        },
        select: { id: true, clientId: true }
      });
      
      assignedTasks = await prisma.task.findMany({
        where: { assignedToId: memberId },
        select: { projectId: true, status: true }
      });
    }
    const uniqueProjectIds = assignedProjects.map(p => p.id);
    const uniqueClientIds = [...new Set(assignedProjects.map(p => p.clientId))];

    // 2. Active production — tasks NOT in DELIVERED/COMPLETED state
    const activeTasksCount = assignedTasks.filter(t => !['DELIVERED', 'COMPLETED'].includes(t.status)).length;

    // 3. Recent projects with full details for the stepper
    let recentProjects = [];
    if (uniqueProjectIds.length > 0) {
      recentProjects = await prisma.project.findMany({
        where: { id: { in: uniqueProjectIds } },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          name: true,
          status: true,
          client: {
             select: { user: { select: { firstName: true, lastName: true } } }
          },
          tasks: {
            where: { assignedToId: memberId },
            select: { id: true, title: true, status: true },
            take: 1,
            orderBy: { updatedAt: 'desc' }
          }
        }
      });
    }

    // 4. Financial: Total earnings = sum of expenses with this userId as recipient (ONLY PAID/SENT)
    const teamExpenses = await prisma.expense.findMany({
      where: { userId: userId },
      select: { amount: true, status: true, createdAt: true, description: true },
      orderBy: { createdAt: 'desc' }
    });
    
    const validStatuses = ['SENT', 'PAID', 'COMPLETED', 'VERIFIED'];
    
    // إجمالي الأرباح - All time paid
    const totalEarnings = teamExpenses
      .filter(e => validStatuses.includes((e.status || '').toUpperCase()))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
      
    // إجمالي ربح الشهر - This month paid (SENT/PAID)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthEarnings = teamExpenses
      .filter(e => 
        validStatuses.includes((e.status || '').toUpperCase()) && 
        e.createdAt.getMonth() === currentMonth && 
        e.createdAt.getFullYear() === currentYear
      )
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // v21.1 Elite: Calculate actually pending dues (not SENT/PAID)
    const pendingPayout = teamExpenses
      .filter(e => (e.status || '').toUpperCase() === 'PENDING')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // 5. Recent payments (last 5 wallet transfers)
    const recentPayments = teamExpenses.slice(0, 5).map(e => ({
      id: e.createdAt.getTime().toString() + Math.random().toString(36).substring(7),
      date: e.createdAt,
      amount: e.amount,
      status: e.status || 'PENDING',
      description: e.description || 'مستحق مالي'
    }));

    // 6. Daily tasks (tasks assigned today or not started)
    let dailyTasks = [];
    if (memberId) {
      dailyTasks = await prisma.task.findMany({
        where: {
          assignedToId: memberId,
          status: { not: 'DELIVERED' },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          deadline: true,
          project: { select: { name: true } }
        }
      });
    }

    // 7. Contract & Salary Info (v20.2)
    const latestContract = await prisma.contract.findFirst({
      where: { memberId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        pdfUrl: true
      }
    });

    res.json({
      stats: {
        assignedClientsCount: uniqueClientIds.length || 0,
        activeProduction: activeTasksCount || 0,
        totalEarnings: Math.max(0, totalEarnings),
        pendingPayout: Math.max(0, pendingPayout),
        thisMonthEarnings: Math.max(0, thisMonthEarnings),
        monthlySalary: Math.max(0, teamMember?.monthlySalary || 0)
      },
      contract: latestContract,
      recentProjects,
      recentPayments,
      dailyTasks
    });

  } catch (error) {
    console.error('[v20.0] Team Dashboard Stats Error:', error);
    // Graceful fallback instead of 500
    res.json({
      stats: { assignedClientsCount: 0, activeProduction: 0, totalEarnings: 0, pendingPayout: 0 },
      recentProjects: [],
      recentPayments: [],
      dailyTasks: []
    });
  }
};
