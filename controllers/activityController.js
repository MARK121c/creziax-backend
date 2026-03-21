const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const activities = await prisma.activityLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true, role: true } } }
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching activity logs' });
  }
};

// Global function to log activity internally
exports.logActivity = async (action, entityType, entityId, details, userId) => {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        entityType,
        entityId,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        userId
      }
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
