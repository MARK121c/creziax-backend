const prisma = require('../prismaClient');

/**
 * Universal Notification Service v18.1
 * Handles database persistence and socket broadcasting for all system alerts.
 */

const createNotification = async (app, { userIds, content, type }) => {
  const io = app.get('io');
  const ids = Array.isArray(userIds) ? userIds : [userIds];

  try {
    // 1. Create DB Records
    await prisma.notification.createMany({
      data: ids.map(id => ({
        content,
        type,
        userId: id
      }))
    });

    // 2. Broadcast to Sockets
    if (io) {
      ids.forEach(id => {
        io.to(`user_${id}`).emit('notification_created', {
          content,
          type,
          createdAt: new Date()
        });
      });
    }
  } catch (err) {
    console.error(" Универсальная ошибка уведомления:", err.message);
  }
};

const notifyAdmins = async (app, { content, type }) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'OWNER'] }
      },
      select: { id: true }
    });
    
    const adminIds = admins.map(a => a.id);
    await createNotification(app, { userIds: adminIds, content: `[إداري] ${content}`, type });
    
    const io = app.get('io');
    if (io) {
      io.to('admins').emit('notification_created', {
        content: `[إداري] ${content}`,
        type
      });
    }
  } catch (err) {
    console.error("Error notifying admins:", err.message);
  }
};

module.exports = { createNotification, notifyAdmins };
