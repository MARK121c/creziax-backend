const prisma = require('../prismaClient');

// @desc    Get messages for a thread (client conversation)
// @route   GET /api/messages?threadId=xxx
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const { threadId } = req.query;
    let where = threadId ? { threadId } : {};

    // --- Access Control ---
    if (req.user.role === 'CLIENT') {
      where = {
        ...where,
        OR: [{ senderId: req.user.id }, { receiverId: req.user.id }]
      };
    }

    if (req.user.role === 'TEAM') {
      // Team members only see threads they are permitted to join
      const hasPermission = req.user.permissions.includes(`chat:${threadId}`);
      // Also allow if it's a project group they are in (projects are currently handled by threadId = projectId in some cases)
      // For now, focusing on the user's specific request for Client DMs
      if (!hasPermission && threadId) {
        // Double check if it's a group thread (projectId) they belong to
        const project = await prisma.project.findFirst({
          where: { id: threadId, teamMembers: { some: { userId: req.user.id } } }
        });
        if (!project) {
          return res.status(403).json({ message: 'غير مصرح لك بالوصول لهذه المحادثة' });
        }
      }
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { content, receiverId, threadId } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'محتوى الرسالة مطلوب' });
    }

    // --- Access Control for Team ---
    if (req.user.role === 'TEAM') {
      const targetId = threadId || receiverId;
      const hasPermission = req.user.permissions.includes(`chat:${targetId}`);
      if (!hasPermission) {
        // Allow if it's a belonging project group
        const project = await prisma.project.findFirst({
          where: { id: threadId, teamMembers: { some: { userId: req.user.id } } }
        });
        if (!project) {
          return res.status(403).json({ message: 'غير مصرح لك بمراسلة هذا العميل ديركت. يرجى طلب الإذن من الأدمن.' });
        }
      }
    }

    // --- Anti-Leaking Filter ---
    const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'OWNER';
    
    if (!isAdmin) {
      const phoneRegex = /(01|\+)[0-9]{8,15}/;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const socialRegex = /(t\.me|wa\.me|whatsapp|telegram)/i;

      if (phoneRegex.test(content) || emailRegex.test(content) || socialRegex.test(content)) {
        return res.status(403).json({ 
          message: 'عذراً، يمنع مشاركة بيانات التواصل الخارجية لضمان أمان العمل والالتزام بسياسة الخصوصية.' 
        });
      }
    }

    const message = await prisma.message.create({
      data: {
        content,
        senderId: req.user.id,
        receiverId: receiverId || null,
        threadId: threadId || null,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
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

// @desc    Create an internal team group
// @route   POST /api/messages/groups
// @access  Private/Admin
const createTeamGroup = async (req, res, next) => {
  try {
    const { name, memberIds } = req.body;

    if (!name || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ message: 'Group name and members are required' });
    }

    // Ensure creator is included
    const participants = [...new Set([...memberIds, req.user.id])];

    const group = await prisma.teamGroup.create({
      data: {
        name,
        members: {
          connect: participants.map(id => ({ id }))
        }
      },
      include: {
        members: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } }
      }
    });

    // Grant permission tags to all members
    const permissionTag = `chat:${group.id}`;
    await Promise.all(participants.map(id => 
      prisma.user.update({
        where: { id },
        data: {
          permissions: {
            push: permissionTag
          }
        }
      })
    ));

    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
};

// @desc    Get team groups for current user
// @route   GET /api/messages/groups
// @access  Private
const getTeamGroups = async (req, res, next) => {
  try {
    const groups = await prisma.teamGroup.findMany({
      where: {
        members: { some: { id: req.user.id } }
      },
      include: {
        members: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } }
      }
    });
    res.json(groups);
  } catch (err) {
    next(err);
  }
};

// @desc    Clear messages (thread-specific or all)
// @route   DELETE /api/messages/clear
// @access  Private/Admin
const clearAllMessages = async (req, res, next) => {
  try {
    const { threadId } = req.query;
    if (threadId) {
      await prisma.message.deleteMany({ where: { threadId } });
      return res.json({ message: 'تم مسح رسائل المحادثة بنجاح' });
    } else {
      await prisma.message.deleteMany({});
      return res.json({ message: 'تم مسح جميع الرسائل بنجاح' });
    }
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a team group
// @route   DELETE /api/messages/groups/:id
// @access  Private/Admin
const deleteTeamGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await prisma.teamGroup.findUnique({
      where: { id },
      include: { members: { select: { id: true, permissions: true } } }
    });
    if (!group) return res.status(404).json({ message: 'الجروب غير موجود' });

    const permissionTag = `chat:${id}`;

    // Strip the permission tag from all members
    await Promise.all(group.members.map(m =>
      prisma.user.update({
        where: { id: m.id },
        data: { permissions: m.permissions.filter(p => p !== permissionTag) }
      })
    ));

    // Delete all messages in this group thread
    await prisma.message.deleteMany({ where: { threadId: id } });

    // Delete the group
    await prisma.teamGroup.delete({ where: { id } });

    res.json({ message: 'تم حذف الجروب بنجاح' });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove a member from a team group
// @route   DELETE /api/messages/groups/:id/members/:userId
// @access  Private/Admin
const removeGroupMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    const permissionTag = `chat:${id}`;

    // Disconnect member from group
    await prisma.teamGroup.update({
      where: { id },
      data: { members: { disconnect: { id: userId } } }
    });

    // Strip the permission tag
    await prisma.user.update({
      where: { id: userId },
      data: { permissions: user.permissions.filter(p => p !== permissionTag) }
    });

    res.json({ message: 'تم إزالة العضو بنجاح' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMessages, sendMessage, getThreads, createTeamGroup, getTeamGroups, clearAllMessages, deleteTeamGroup, removeGroupMember };
