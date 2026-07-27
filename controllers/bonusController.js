const prisma = require('../prismaClient');

// @desc    Get all bonuses (admin) or user bonuses
// @route   GET /api/bonuses
// @access  Private
exports.getBonuses = async (req, res, next) => {
  try {
    let where = {};
    if (req.user.role === 'TEAM') {
      where = { userId: req.user.id };
    }

    const bonuses = await prisma.bonus.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bonuses);
  } catch (err) {
    next(err);
  }
};

// @desc    Create a bonus/penalty
// @route   POST /api/bonuses
// @access  Private/Admin
exports.createBonus = async (req, res, next) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount === undefined) {
      return res.status(400).json({ message: 'User ID and amount are required' });
    }

    const bonus = await prisma.bonus.create({
      data: {
        userId,
        amount: parseFloat(amount),
        reason
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Emit real-time "Tin" notification to the team member
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('bonus_received', {
        amount,
        reason,
        type: amount >= 0 ? 'BONUS' : 'PENALTY'
      });
    }

    res.status(201).json(bonus);
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a bonus
// @route   DELETE /api/bonuses/:id
// @access  Private/Admin
exports.deleteBonus = async (req, res, next) => {
  try {
    await prisma.bonus.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
