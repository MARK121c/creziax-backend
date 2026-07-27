const prisma = require('../prismaClient');

// @desc    Get active broadcasts
// @route   GET /api/broadcasts
// @access  Private (All)
const getActiveBroadcasts = async (req, res) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a broadcast
// @route   POST /api/broadcasts
// @access  Private (Admin)
const createBroadcast = async (req, res) => {
  try {
    const { message, isActive } = req.body;
    
    // Deactivate previous broadcasts if making a new active one
    if (isActive !== false) {
      await prisma.broadcast.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        message,
        isActive: isActive !== false, // default true
        authorId: req.user.id
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('broadcast_updated', broadcast);
    }
    
    res.status(201).json(broadcast);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a broadcast
// @route   PUT /api/broadcasts/:id
// @access  Private (Admin)
const updateBroadcast = async (req, res) => {
  try {
    const { message, isActive } = req.body;
    
    if (isActive === true) {
      // Deactivate others
      await prisma.broadcast.updateMany({
        where: { id: { not: req.params.id }, isActive: true },
        data: { isActive: false }
      });
    }

    const broadcast = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: { message, isActive }
    });
    
    const io = req.app.get('io');
    if (io) {
      io.emit('broadcast_updated', broadcast);
    }

    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a broadcast
// @route   DELETE /api/broadcasts/:id
// @access  Private (Admin)
const deleteBroadcast = async (req, res) => {
  try {
    await prisma.broadcast.delete({
      where: { id: req.params.id }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('broadcast_updated', null);
    }

    res.json({ message: 'Broadcast removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getActiveBroadcasts,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast
};
