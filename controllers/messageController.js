const prisma = require('../prismaClient');

// @desc    Get messages for a thread (client conversation)
// @route   GET /api/messages?threadId=xxx
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const { threadId } = req.query;
    const where = threadId ? { threadId } : {};
    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res, next) => {
  try {
    const { content, receiverId, threadId } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const message = await prisma.message.create({
      data: {
        content,
        senderId: req.user.id,
        receiverId: receiverId || null,
        threadId: threadId || null,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

// @desc    Get all threads (for admin to see all conversations)
// @route   GET /api/messages/threads
// @access  Private/Admin
const getThreads = async (req, res, next) => {
  try {
    const threads = await prisma.message.findMany({
      where: { threadId: { not: null } },
      select: { threadId: true },
      distinct: ['threadId'],
    });
    res.json(threads);
  } catch (err) {
    next(err);
  }
};

module.exports = { getMessages, sendMessage, getThreads };
