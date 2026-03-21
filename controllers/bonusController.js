const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getBonuses = async (req, res) => {
  try {
    const bonuses = await prisma.bonus.findMany({ 
      orderBy: { date: 'desc' },
      include: { user: { select: { firstName: true, lastName: true, email: true } } }
    });
    res.json(bonuses);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching bonuses' });
  }
};

exports.createBonus = async (req, res) => {
  try {
    const { amount, reason, date, userId } = req.body;
    const bonus = await prisma.bonus.create({
      data: { 
        amount: parseFloat(amount), 
        reason, 
        userId,
        date: date ? new Date(date) : undefined 
      },
      include: { user: true }
    });

    await prisma.activityLog.create({
      data: {
        action: 'CREATE',
        entityType: 'BONUS',
        entityId: bonus.id,
        details: JSON.stringify({ amount, userId, reason }),
        userId: req.user.userId
      }
    });

    res.status(201).json(bonus);
  } catch (error) {
    res.status(500).json({ error: 'Error creating bonus' });
  }
};

exports.deleteBonus = async (req, res) => {
  try {
    const bonus = await prisma.bonus.delete({ where: { id: req.params.id } });

    await prisma.activityLog.create({
      data: {
        action: 'DELETE',
        entityType: 'BONUS',
        entityId: bonus.id,
        details: JSON.stringify({ amount: bonus.amount, userId: bonus.userId }),
        userId: req.user.userId
      }
    });

    res.json({ message: 'Bonus deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting bonus' });
  }
};
