const prisma = require('../prismaClient');

// @desc    Get messages for a thread (client conversation)
// @route   GET /api/messages?threadId=xxx
// @access  Private
const getMessages = async (req, res, next) => {
  try {
    const { threadId } = req.query;
    let where = {};

    if (threadId) {
      where = {
        OR: [
          // For Project/Team Group chats (threadId is a project/group ID)
          { threadId: threadId },
          // For Private DMs (threadId is the OTHER user's userId)
          // v20.2.6-CRITICAL: ONLY fetch messages between THIS user and the target user
          {
            threadId: null,
            OR: [
              { senderId: req.user.id, receiverId: threadId },
              { senderId: threadId, receiverId: req.user.id }
            ]
          }
        ]
      };
    }

    // --- Access Control ---
    if (req.user.role === 'CLIENT') {
      where = {
        ...where,
        AND: [ // Client can only see their own DMs or Group messages
          { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }, { threadId: { not: null } }] }
        ]
      };
    }

    if (req.user.role === 'TEAM' && threadId) {
      // v20.2.6: Check if threadId is a User ID (private DM)
      const targetUser = await prisma.user.findUnique({ where: { id: threadId } });
      
      if (targetUser) {
        // It's a DM conversation - validate it's between appropriate parties
        // Team can always DM Admin/Owner
        const isAdminTarget = targetUser.role === 'ADMIN' || targetUser.role === 'OWNER';
        if (!isAdminTarget) {
          const hasPermission = (req.user.permissions || []).includes(`chat:${threadId}`);
          if (!hasPermission) {
            return res.status(403).json({ message: 'غير مصرح لك بالوصول لهذه المحادثة' });
          }
        }
        // DM access granted - continue
      } else {
        // It's a Group/Project thread - check membership
        const hasPermission = (req.user.permissions || []).includes(`chat:${threadId}`);
        if (!hasPermission) {
          const project = await prisma.project.findFirst({
            where: { 
              id: threadId,
              OR: [
                { teamMembers: { some: { userId: req.user.id } } },
                { phases: { some: { tasks: { some: { assignedTo: { userId: req.user.id } } } } } }
              ]
            }
          });
          
          let inTeamGroup = false;
          if (!project) {
            const teamGroup = await prisma.teamGroup.findFirst({
              where: { id: threadId, members: { some: { id: req.user.id } } }
            });
            if (teamGroup) inTeamGroup = true;
          }

          if (!project && !inTeamGroup) {
            return res.status(403).json({ message: 'غير مصرح لك بالوصول لهذه المحادثة' });
          }
        }
      }
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        parent: { // Include parent message for replies
          select: {
            id: true,
            content: true,
            sender: { select: { firstName: true, lastName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }, // Get latest first for performance
      take: 100, // Limit to prevent browser crash
    });

    // v17.2 WhatsApp-Style Deletion Filters + Reverse for UI display
    const processedMessages = messages
      .filter(m => !(m.deletedFor || []).includes(req.user.id))
      .map(m => {
        if (m.isDeleted) return { ...m, content: '🚫 تم حذف هذه الرسالة', isDeleted: true };
        return m;
      })
      .reverse(); // Back to chronological order

    res.json(processedMessages);
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { content, receiverId, threadId, parentId, senderSocketId } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'محتوى الرسالة مطلوب' });
    }

    // --- Access Control for Team ---
    if (req.user.role === 'TEAM') {
      if (receiverId) {
        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
        if (receiver && (receiver.role === 'ADMIN' || receiver.role === 'OWNER')) {
          // Support DM is ALWAYS allowed
        } else {
          const hasPermission = (req.user.permissions || []).includes(`chat:${receiverId}`);
          if (!hasPermission) {
            return res.status(403).json({ message: 'غير مصرح لك بمراسلة هذا المستخدم. يرجى طلب الإذن.' });
          }
        }
      } else if (threadId) {
        // v20.2.6-ELITE: Simplified & Fixed Group Access Check
        const hasPermission = (req.user.permissions || []).includes(`chat:${threadId}`);
        if (!hasPermission) {
          // Get the user's TeamMember record
          const teamMember = await prisma.teamMember.findUnique({
            where: { userId: req.user.id }
          });

          let hasAccess = false;

          if (teamMember) {
            // Check 1: Is this team member directly in the project?
            const inProject = await prisma.project.findFirst({
              where: {
                id: threadId,
                teamMembers: { some: { id: teamMember.id } }
              }
            });

            if (inProject) {
              hasAccess = true;
            } else {
              // Check 2: Is there a task in this project assigned to them?
              const assignedTask = await prisma.task.findFirst({
                where: {
                  projectId: threadId,
                  assignedToId: teamMember.id
                }
              });
              if (assignedTask) hasAccess = true;
            }
          }

          // Check 3: Is this a TeamGroup and are they a member?
          if (!hasAccess) {
            const teamGroup = await prisma.teamGroup.findFirst({
              where: { id: threadId, members: { some: { id: req.user.id } } }
            });
            if (teamGroup) hasAccess = true;
          }

          if (!hasAccess) {
            return res.status(403).json({ 
              message: 'فشل إرسال الرسالة: ليس لديك صلاحية في هذا الجروب. اطلب الإسناد للمشروع أولاً.' 
            });
          }
        }
      }
    }

    // --- Surgical Anti-Leaking System (v21.6) ---
    const isOwner = req.user.role === 'OWNER';
    const isAdmin = req.user.role === 'ADMIN' || isOwner;
    
    if (!isAdmin) {
      const phoneRegex = /(01|\+)[0-9]{8,15}/;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const socialRegex = /(t\.me|wa\.me|whatsapp|telegram|instagram\.com|facebook\.com)/i;

      if (phoneRegex.test(content) || emailRegex.test(content) || socialRegex.test(content)) {
        // 🚨 BREACH DETECTED: Notify OWNER immediately
        try {
          const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
          if (owner) {
            const userName = `${req.user.firstName} ${req.user.lastName || ''}`.trim();
            const breachMsg = `⚠️ محاولة اختراق قواعد المنصة: العضو [${userName}] حاول إرسال بيانات اتصال مكشوفة. المحتوى المحجوب: "${content}"`;
            
            await prisma.notification.create({
              data: {
                userId: owner.id,
                content: breachMsg,
                type: 'WARNING'
              }
            });

            const io = req.app.get('io');
            if (io) {
              io.to(`user_${owner.id}`).emit('notification_created', {
                content: breachMsg,
                type: 'WARNING',
                senderName: 'Creziax Security'
              });
            }
          }
        } catch (notifErr) {
          console.error("Failed to notify owner of breach:", notifErr);
        }

        return res.status(403).json({ 
          message: 'ممنوع مشاركة بيانات الاتصال الشخصية لضمان أمان العمل والالتزام بسياسة الخصوصية.' 
        });
      }
    }

    const message = await prisma.message.create({
      data: {
        content,
        senderId: req.user.id,
        receiverId: receiverId || null,
        threadId: threadId || null,
        parentId: parentId || null,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } },
        parent: {
          select: {
            id: true,
            content: true,
            sender: { select: { firstName: true, lastName: true } }
          }
        }
      },
    });

    // v21.4 Elite Sync: Persistent Message Notifications History
    const senderName = `${req.user.firstName} ${req.user.lastName || ''}`.trim();
    const notifMsg = `${senderName}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`;
    const io = req.app.get('io');
    
    // 1. Private DM Notification
    if (receiverId && receiverId !== req.user.id) {
       await prisma.notification.create({
         data: {
           userId: receiverId,
           content: `[رسالة] ${notifMsg}`,
           type: 'MESSAGE'
         }
       });
       if (io) {
          io.to(`user_${receiverId}`).emit('notification_created', {
            id: message.id,
            content: notifMsg,
            type: 'MESSAGE',
            senderName: senderName,
            senderSocketId: senderSocketId || null, 
            threadId: null
          });
       }
    } 
    // 2. Group Notification (Project or Team Group) - V20.2.6 Elite Isolation
    else if (threadId && !receiverId) {
       // Find all recipients in this thread
       let participants = [];
       
       // Check if it's a Project Group
       const p = await prisma.project.findUnique({
         where: { id: threadId },
         include: { teamMembers: { select: { userId: true } }, client: { select: { userId: true } }, phases: { include: { tasks: { select: { assignedTo: { select: { userId: true } } } } } } }
       });
       
       if (p) {
         if (p.client?.userId) participants.push(p.client.userId);
         p.teamMembers.forEach(tm => participants.push(tm.userId)); p.phases?.forEach(ph => ph.tasks?.forEach(t => { if (t.assignedTo?.userId) participants.push(t.assignedTo.userId); }));
       } else {
         // Check if it's a Team Group
         const g = await prisma.teamGroup.findUnique({
           where: { id: threadId },
           include: { members: true }
         });
         if (g) {
           g.members.forEach(m => participants.push(m.id));
         }
       }

       // Filter out the sender and duplicates
       const uniqueRecipients = [...new Set(participants)].filter(id => id !== req.user.id);
       
       // Bulk create notifications (v21.4 Elite Efficiency)
       if (uniqueRecipients.length > 0) {
         await prisma.notification.createMany({
           data: uniqueRecipients.map(id => ({
             userId: id,
             content: `[جروب] ${notifMsg}`,
             type: 'MESSAGE'
           }))
         });
         
         if (io) {
           uniqueRecipients.forEach(rid => {
             io.to(`user_${rid}`).emit('notification_created', {
               id: message.id,
               content: notifMsg,
               type: 'MESSAGE',
               senderId: req.user.id,
               senderName: senderName,
               senderSocketId: senderSocketId || null,
               threadId: threadId
             });
           });
         }
       }
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

// @desc    Get all active conversation threads with metadata
// @route   GET /api/messages/threads
// @access  Private/Admin
const getThreads = async (req, res, next) => {
  try {
    // v19.5 Supreme: Hard Thread Filtering
    const userId = req.user.id;
    const role = req.user.role;
    const isAdmin = role === 'ADMIN' || role === 'OWNER';

    // 1. Get Group Threads (Projects / Team Groups)
    let groupWhere = { threadId: { not: null } };
    if (!isAdmin) {
      if (role === 'CLIENT') {
        const client = await prisma.client.findUnique({ where: { userId } });
        const projects = await prisma.project.findMany({ 
          where: { clientId: client?.id }, 
          select: { id: true } 
        });
        groupWhere = { threadId: { in: projects.map(p => p.id) } };
      } else if (role === 'TEAM') {
        // Find explicitly assigned projects
        const projects = await prisma.project.findMany({
          where: {
            OR: [
              { teamMembers: { some: { userId: userId } } },
              { phases: { some: { tasks: { some: { assignedTo: { userId: userId } } } } } }
            ]
          },
          select: { id: true }
        });
        // Find team groups
        const teamGroups = await prisma.teamGroup.findMany({
          where: { members: { some: { id: userId } } },
          select: { id: true }
        });
        
        // Also add any threads they have explicit permissions to
        const permissionIds = (req.user.permissions || [])
          .filter(p => p.startsWith('chat:'))
          .map(p => p.split(':')[1]);

        const allowedIds = [
          ...projects.map(p => p.id),
          ...teamGroups.map(g => g.id),
          ...permissionIds
        ];
        
        groupWhere = { threadId: { in: allowedIds } };
      }
    }

    const groupThreads = await prisma.message.findMany({
      where: groupWhere,
      select: { threadId: true, content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['threadId'],
    });

    // 2. Get Private DMs
    let dmWhere = { threadId: null };
    if (!isAdmin) {
      // For Clients/Team, DMs must involve them
      dmWhere = { 
        threadId: null,
        OR: [{ senderId: userId }, { receiverId: userId }]
      };
    }

    const dmThreads = await prisma.message.findMany({
      where: dmWhere,
      select: { senderId: true, receiverId: true, content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ groups: groupThreads, dms: dmThreads });
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
      // v18.0 THE WIPEOUT PROTOCOL: Hard Delete exactly one thread
      await prisma.message.deleteMany({
        where: {
          OR: [
            { threadId: threadId },
            {
              threadId: null,
              OR: [
                { senderId: threadId, receiverId: { not: null } },
                { receiverId: threadId }
              ]
            }
          ]
        }
      });

      const io = req.app.get('io');
      if (io) {
          // v20.2.6: Use 'messages_cleared' NOT 'chat_deleted'
          // 'chat_deleted' removes group from sidebar (wrong!)
          // 'messages_cleared' only clears messages but keeps the group visible
          
          // Broadcast to project room
          io.to(`project_${threadId}`).emit('messages_cleared', { threadId });
          
          // For private DMs, cross-broadcast to both participants
          // This ensures live sync for BOTH users viewing each other
          io.to(`user_${threadId}`).emit('messages_cleared', { threadId: req.user.id });
          io.to(`user_${req.user.id}`).emit('messages_cleared', { threadId: threadId });
          
          io.to('admins').emit('messages_cleared', { threadId });
          io.to('admins').emit('messages_cleared', { threadId: req.user.id });
      }

      return res.json({ message: 'تم مسح جميع الرسائل في هذه المحادثة بنجاح' });
    } else {
      await prisma.message.deleteMany({});
      const io = req.app.get('io');
      if (io) io.emit('chat_deleted', { threadId: 'ALL' });
      return res.json({ message: 'تم مسح جميع الرسائل في السيستم بنجاح' });
    }
  } catch (err) {
    next(err);
  }
};

// @desc    Mark all messages in a thread as read
// @route   POST /api/messages/mark-read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const { threadId } = req.body;
    if (!threadId) return res.status(400).json({ message: 'Thread ID is required' });

    await prisma.message.updateMany({
      where: {
        AND: [
          { OR: [{ threadId: threadId }, { senderId: threadId }, { receiverId: threadId }] },
          { receiverId: req.user.id },
          { isRead: false }
        ]
      },
      data: { isRead: true }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle pin status of a message
// @route   PATCH /api/messages/:id/pin
// @access  Private/Admin
const togglePinMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) return res.status(404).json({ message: 'الرسالة غير موجودة' });

    const updatedMessage = await prisma.message.update({
      where: { id },
      data: {
        isPinned: !message.isPinned,
        pinnedAt: !message.isPinned ? new Date() : null
      }
    });

    const io = req.app.get('io');
    if (io) {
      const room = message.threadId ? `project_${message.threadId}` : `user_${message.receiverId}`;
      io.to(room).emit('message_pinned', { id, isPinned: !message.isPinned });
      
      // Mandatory: In a Private DM, broadcast to BOTH participants (even if they have multiple devices)
      if (!message.threadId) {
        io.to(`user_${message.senderId}`).emit('message_pinned', { id, isPinned: !message.isPinned });
        io.to(`user_${message.receiverId}`).emit('message_pinned', { id, isPinned: !message.isPinned });
      }
      
      // Support for Admin/owner dashboard collective visibility
      io.to('admins').emit('message_pinned', { 
        id, 
        isPinned: !message.isPinned, 
        threadId: message.threadId, 
        senderId: message.senderId, 
        receiverId: message.receiverId 
      });
      
      console.log(`[Socket-SUPREME] Pinned message ${id} in room ${room} and admins`);
    } else {
      console.warn(`[Socket-SUPREME] IO instance not found for pinning ${id}`);
    }

    res.json(updatedMessage);
  } catch (err) {
    console.error("❌ Pin Toggle Error:", err);
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

// @desc    Add a member to a team group
// @route   POST /api/messages/groups/:id/members
// @access  Private/Admin
const addGroupMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ message: 'userId مطلوب' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    const group = await prisma.teamGroup.findUnique({ where: { id } });
    if (!group) return res.status(404).json({ message: 'الجروب غير موجود' });

    const permissionTag = `chat:${id}`;

    // Add member to group in DB
    const updatedGroup = await prisma.teamGroup.update({
      where: { id },
      data: { members: { connect: { id: userId } } },
      include: {
        members: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } }
      }
    });

    // Grant permission tag if user doesn't already have it
    if (!user.permissions.includes(permissionTag)) {
      await prisma.user.update({
        where: { id: userId },
        data: { permissions: { push: permissionTag } }
      });
    }

    res.json({ message: 'تم إضافة العضو للجروب بنجاح', group: updatedGroup });
  } catch (err) {
    next(err);
  }
};

// @desc    v17.2 Delete a single message (for Everyone or just for Me)
// @route   DELETE /api/messages/:id?type=everyone|me
// @access  Private
const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'everyone' or 'me'
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'الرسالة غير موجودة' });

    if (type === 'everyone') {
      const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';
      if (msg.senderId !== userId && !isAdmin) {
        return res.status(403).json({ message: 'غير مصرح لك بحذف هذه الرسالة للجميع' });
      }
      // v18.0 WIPE OUT PROTOCOL: Hard Delete from database
      await prisma.message.delete({
        where: { id }
      });

      const io = req.app.get('io');
      if (io) {
        if (msg.threadId) {
          const projectRoom = `project_${msg.threadId}`;
          // v21.5 Elite Sync: Universal broadcast to the group room
          io.to(projectRoom).emit('message_deleted', { id });
          // Ensure admins are synced regardless of room membership
          io.to('admins').emit('message_deleted', { id });
        } else {
          // v21.5 Private Sync: Broadcast to both sender and receiver rooms
          if (msg.receiverId) io.to(`user_${msg.receiverId}`).emit('message_deleted', { id });
          if (msg.senderId) io.to(`user_${msg.senderId}`).emit('message_deleted', { id });
          io.to('admins').emit('message_deleted', { id });
        }
      }

      return res.json({ success: true, message: 'Message permanently deleted for everyone' });
    } else {
      // v17.5 Strict Safeguard against null arrays
      const currentDeletedFor = msg.deletedFor || [];
      if (!currentDeletedFor.includes(userId)) {
        await prisma.message.update({
          where: { id },
          data: { deletedFor: { push: userId } }
        });
      }
      return res.json({ success: true, id, type: 'me' });
    }
  } catch (err) {
    console.error("❌ Delete Error:", err);
    next(err);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await prisma.message.updateMany({
      where: { 
        receiverId: userId,
        isRead: false
      },
      data: { isRead: true }
    });
    res.json({ success: true, message: 'All messages marked as read' });
  } catch (err) {
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false
      }
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
};


module.exports = { getMessages, sendMessage, getThreads, createTeamGroup, getTeamGroups, clearAllMessages, deleteTeamGroup, removeGroupMember, addGroupMember, markAsRead, togglePinMessage, deleteMessage, markAllAsRead, getUnreadCount };
