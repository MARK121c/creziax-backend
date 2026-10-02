const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst({ where: { role: 'TEAM' } });
    if (!user) { console.log('No TEAM user found'); return; }
    console.log('Testing with user:', user.id);
    
    // Simulate getTeamDashboardStats
    const userId = user.id;
    const teamMember = await prisma.teamMember.findUnique({ where: { userId: userId } });
    const memberId = teamMember ? teamMember.id : null;
    console.log('memberId:', memberId);
    
    let assignedTasks = [];
    if (memberId) {
      assignedTasks = await prisma.task.findMany({
        where: { assignedToId: memberId },
        select: { projectId: true, status: true }
      });
    }
    const uniqueProjectIds = [...new Set(assignedTasks.map(t => t.projectId).filter(Boolean))];
    const activeTasksCount = assignedTasks.filter(t => !['DELIVERED', 'COMPLETED'].includes(t.status)).length;
    
    let recentProjects = [];
    if (uniqueProjectIds.length > 0) {
      recentProjects = await prisma.project.findMany({
        where: { id: { in: uniqueProjectIds } },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true, name: true, status: true,
          client: { select: { user: { select: { firstName: true, lastName: true } } } },
          tasks: {
            where: { assignedToId: memberId },
            select: { id: true, title: true, status: true },
            take: 1, orderBy: { updatedAt: 'desc' }
          }
        }
      });
    }
    
    const teamExpenses = await prisma.expense.findMany({
      where: { userId: userId },
      select: { amount: true, status: true, createdAt: true, description: true },
      orderBy: { createdAt: 'desc' }
    });
    const totalEarnings = teamExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const pendingPayout = teamExpenses.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const recentPayments = teamExpenses.slice(0, 5).map(e => ({
      id: e.createdAt.getTime().toString() + Math.random().toString(36).substring(7),
      date: e.createdAt, amount: e.amount, status: e.status || 'PENDING', description: e.description || 'مستحق مالي'
    }));
    
    let dailyTasks = [];
    if (memberId) {
      dailyTasks = await prisma.task.findMany({
        where: { assignedToId: memberId, status: { not: 'DELIVERED' } },
        orderBy: { createdAt: 'desc' }, take: 8,
        select: { id: true, title: true, status: true, deadline: true, project: { select: { name: true } } }
      });
    }
    
    const payload = {
      stats: {
        assignedClientsCount: uniqueProjectIds.length || 0,
        activeProduction: activeTasksCount || 0,
        totalEarnings: totalEarnings || 0,
        pendingPayout: pendingPayout || 0
      },
      recentProjects,
      recentPayments,
      dailyTasks
    };
    
    console.log('SUCCESS! Payload:', JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
