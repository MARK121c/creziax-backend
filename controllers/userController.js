const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');

// Calculate comprehensive team performance & commitment metrics (Tasks + Presence + Chat engagement)
const calculateTeamPerformance = ({
  tasks = [],
  lastActiveAt = null,
  isOnline = false,
  messagesCount = 0,
  leadsCount = 0,
  activityCount = 0,
  position = ''
} = {}) => {
  const now = new Date();
  
  // Pillar 1: Task Execution & Deliveries (Weight: 45%)
  let taskScore = 100;
  const totalTasks = tasks.length;
  const completedTasksList = tasks.filter(t => t.status === 'DELIVERED');
  const completedTasks = completedTasksList.length;
  const inProgressTasks = totalTasks - completedTasks;

  let onTimeTasks = 0;
  completedTasksList.forEach(t => {
    if (!t.deadline || new Date(t.updatedAt) <= new Date(t.deadline)) {
      onTimeTasks++;
    }
  });

  let overdueTasks = 0;
  tasks.forEach(t => {
    if (t.status !== 'DELIVERED' && t.deadline && new Date(t.deadline) < now) {
      overdueTasks++;
    }
  });

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const onTimeRate = completedTasks > 0 ? Math.round((onTimeTasks / completedTasks) * 100) : 100;

  if (totalTasks > 0) {
    taskScore = Math.max(0, (completionRate * 0.6) + (onTimeRate * 0.4) - (overdueTasks * 8));
  } else {
    // If member has no assigned tasks yet (e.g. Sales, Manager, or newly joined), baseline is 95%
    taskScore = 95;
  }

  // Pillar 2: Platform Activity & Live Presence (Weight: 30%)
  let presenceScore = 70;
  if (isOnline) {
    presenceScore = 100; // Currently connected online
  } else if (lastActiveAt) {
    const hoursSinceActive = (now - new Date(lastActiveAt)) / (1000 * 60 * 60);
    if (hoursSinceActive <= 6) {
      presenceScore = 95; // Active within last 6 hours
    } else if (hoursSinceActive <= 24) {
      presenceScore = 85; // Active within last 24 hours
    } else if (hoursSinceActive <= 48) {
      presenceScore = 75; // Active within 2 days
    } else if (hoursSinceActive <= 120) {
      presenceScore = 60; // Active within 5 days
    } else {
      presenceScore = Math.max(30, 60 - Math.round((hoursSinceActive - 120) / 24) * 5);
    }
  } else {
    presenceScore = 60;
  }

  if (activityCount >= 10) presenceScore = Math.min(100, presenceScore + 10);
  else if (activityCount >= 5) presenceScore = Math.min(100, presenceScore + 5);

  // Pillar 3: Chat Engagement & Follow-up Responsiveness (Weight: 25%)
  let communicationScore = 70;
  const isSales = (position || '').toLowerCase().includes('sales') || (position || '').includes('مبيعات') || (position || '').includes('تسويق');
  const totalInteractions = messagesCount + (isSales ? leadsCount * 5 : 0);

  if (totalInteractions >= 30) {
    communicationScore = 100;
  } else if (totalInteractions >= 15) {
    communicationScore = 90;
  } else if (totalInteractions >= 5) {
    communicationScore = 80;
  } else if (totalInteractions >= 1) {
    communicationScore = 75;
  } else {
    communicationScore = 65;
  }

  // Composite Weighted Score
  const rawScore = (taskScore * 0.45) + (presenceScore * 0.30) + (communicationScore * 0.25);
  const commitmentScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  let rating = 'ممتاز';
  if (commitmentScore < 50) {
    rating = 'يحتاج تحسين';
  } else if (commitmentScore < 75) {
    rating = 'جيد';
  } else if (commitmentScore < 90) {
    rating = 'جيد جداً';
  }

  let avgDeliveryHours = '0.0';
  if (completedTasks > 0) {
    const totalMs = completedTasksList.reduce((sum, t) => sum + (new Date(t.updatedAt) - new Date(t.createdAt)), 0);
    avgDeliveryHours = ((totalMs / completedTasks) / (1000 * 60 * 60)).toFixed(1);
  }

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    onTimeTasks,
    overdueTasks,
    completionRate,
    onTimeRate,
    commitmentScore,
    rating,
    lifetimeVideos: completedTasks,
    averageDeliveryHours: avgDeliveryHours,
    breakdown: {
      taskScore: Math.round(taskScore),
      presenceScore: Math.round(presenceScore),
      communicationScore: Math.round(communicationScore),
      messagesCount,
      leadsCount
    }
  };
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        clientInfo: {
          include: {
            invoices: {
              where: { status: 'PAID' },
              select: { amount: true }
            }
          }
        },
        teamMemberInfo: {
          include: {
            tasks: true
          }
        },
        expenses: true,
        bonuses: true,
        _count: {
          select: {
            messagesSent: true,
            createdLeads: true,
            activityLogs: true
          }
        }
      }
    });
    
    const enrichedUsers = users.map(u => {
      if (u.role === 'CLIENT') {
        const totalPaid = u.clientInfo?.invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
        return {
          ...u,
          totalPaid,
          company: u.clientInfo?.company,
          phone: u.clientInfo?.phone,
          tier: u.clientInfo?.tier,
          isVip: u.clientInfo?.isVip,
          logoUrl: u.clientInfo?.logoUrl,
          notionLink: u.clientInfo?.notionLink,
          telegram: u.clientInfo?.telegram,
          managedChannels: u.clientInfo?.managedChannels,
          healthScore: u.clientInfo?.healthScore,
          internalNotes: u.clientInfo?.internalNotes,
          preferredCurrency: u.clientInfo?.preferredCurrency,
          contractStartDate: u.clientInfo?.contractStartDate,
          contractEndDate: u.clientInfo?.contractEndDate,
        };
      }
      if (u.role === 'TEAM' || u.role === 'ADMIN' || u.role === 'OWNER') {
        const tm = u.teamMemberInfo || {};
        const totalPaid = u.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const monthlySalary = tm.monthlySalary || 0;
        const totalBonuses = u.bonuses?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
        
        const performance = calculateTeamPerformance({
          tasks: tm.tasks || [],
          lastActiveAt: u.lastActiveAt,
          isOnline: u.isOnline,
          messagesCount: u._count?.messagesSent || 0,
          leadsCount: u._count?.createdLeads || 0,
          activityCount: u._count?.activityLogs || 0,
          position: tm.position
        });

        return {
          ...u,
          position: tm.position,
          company: tm.company,
          phone: tm.phone,
          notionLink: tm.notionLink,
          telegram: tm.telegram,
          managedChannels: tm.managedChannels,
          healthScore: tm.healthScore,
          internalNotes: tm.internalNotes,
          performance,
          finance: {
            totalSalary: monthlySalary,
            earnedBonuses: totalBonuses,
            paid: totalPaid,
            remaining: Math.max(0, (monthlySalary + totalBonuses) - totalPaid)
          }
        };
      }
      return u;
    });

    res.json(enrichedUsers);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        clientInfo: {
          include: {
            invoices: {
              where: { status: 'PAID' },
              select: { amount: true }
            }
          }
        },
        teamMemberInfo: {
          include: {
            tasks: true
          }
        },
        expenses: true,
        bonuses: true,
        _count: {
          select: {
            messagesSent: true,
            createdLeads: true,
            activityLogs: true
          }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'CLIENT') {
      user.totalPaid = user.clientInfo?.invoices?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
    }

    if (user.role === 'TEAM' || user.role === 'ADMIN' || user.role === 'OWNER') {
      const tm = user.teamMemberInfo || {};
      const totalPaid = user.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      const monthlySalary = tm.monthlySalary || 0;
      const totalBonuses = user.bonuses?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
      
      const performance = calculateTeamPerformance({
        tasks: tm.tasks || [],
        lastActiveAt: user.lastActiveAt,
        isOnline: user.isOnline,
        messagesCount: user._count?.messagesSent || 0,
        leadsCount: user._count?.createdLeads || 0,
        activityCount: user._count?.activityLogs || 0,
        position: tm.position
      });

      user.position = tm.position;
      user.company = tm.company;
      user.phone = tm.phone;
      user.notionLink = tm.notionLink;
      user.telegram = tm.telegram;
      user.managedChannels = tm.managedChannels;
      user.healthScore = tm.healthScore;
      user.internalNotes = tm.internalNotes;
      
      user.performance = performance;

      user.finance = {
        totalSalary: monthlySalary,
        earnedBonuses: totalBonuses,
        paid: totalPaid,
        remaining: Math.max(0, (monthlySalary + totalBonuses) - totalPaid)
      };
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new user (Client or Team Member)
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res, next) => {
  try {
    let { firstName, lastName, email, password, role, company, phone, position, avatarUrl, permissions, notionLink, telegram } = req.body;
    if (email) email = email.toLowerCase().trim();


    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Role Title validation for TEAM members (Must be one of: Strategist, Manager, Scriptwriter, Video Editor, Graphic Designer, Sales)
    const allowedTitles = ['Strategist', 'Manager', 'Scriptwriter', 'Video Editor', 'Graphic Designer', 'Sales', 'Sales Specialist', 'Marketing'];
    if (role === 'TEAM' && position && !allowedTitles.includes(position) && position !== 'Custom') {
      // Allow if valid title or custom string
    }

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Only OWNER can create ADMIN or OWNER
    if (role === 'ADMIN' || role === 'OWNER') {
      if (req.user.role !== 'OWNER') {
        return res.status(403).json({ message: 'Only owners can create administrators' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
        avatarUrl,
        permissions: permissions || [],
      },
    });

    // If role is CLIENT, create client record
    if (role === 'CLIENT') {
      await prisma.client.create({
        data: { 
          userId: user.id, 
          company, 
          phone,
          isVip: req.body.isVip || false,
          tier: req.body.tier || 'REGULAR',
          logoUrl: req.body.logoUrl,
          notionLink: notionLink,
          telegram: telegram,
          managedChannels: req.body.managedChannels ? parseInt(req.body.managedChannels) : 0,
          contractStartDate: req.body.contractStartDate ? new Date(req.body.contractStartDate) : null,
          contractEndDate: req.body.contractEndDate ? new Date(req.body.contractEndDate) : null,
          healthScore: req.body.healthScore || 'GOOD',
          internalNotes: req.body.internalNotes
        },
      });

      // Notify Owner about new client onboarding
      const { sendEmail } = require('../services/emailService');
      const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
      if (owner) {
        sendEmail(
          owner.email,
          'تم إضافة عميل جديد - Creziax',
          `تم إنشاء حساب جديد للعميل ${firstName} ${lastName} بنجاح.`,
          `<div style="font-family: sans-serif;">
            <h2 style="color: #4f46e5;">عميل جديد على المنصة</h2>
            <p>مرحباً <strong>${owner.firstName}</strong>،</p>
            <p>تم تسجيل عميل جديد:</p>
            <ul>
              <li>الاسم: <strong>${firstName} ${lastName}</strong></li>
              <li>الشركة: ${company || 'N/A'}</li>
              <li>البريد: ${email}</li>
            </ul>
            <p>تم الانتهاء من عملية Onboarding للعميل بنجاح.</p>
          </div>`
        ).catch(err => console.error('New client email alert failed:', err));
      }
    }

    if (role === 'TEAM' || role === 'ADMIN') {
      await prisma.teamMember.create({
        data: { 
          userId: user.id, 
          position,
          company,
          phone,
          notionLink,
          telegram,
          managedChannels: req.body.managedChannels ? parseInt(req.body.managedChannels) : 0,
          healthScore: req.body.healthScore || 'GOOD',
          internalNotes: req.body.internalNotes,
          monthlySalary: req.body.monthlySalary ? parseFloat(req.body.monthlySalary) : 0
        },
      });
    }

    // Unified response
    const resPayload = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    if (role === 'TEAM' || role === 'ADMIN') {
      resPayload.position = position;
    }

    res.status(201).json(resPayload);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check target user's role
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Only OWNER can delete an ADMIN or OWNER
    if (targetUser.role === 'ADMIN' || targetUser.role === 'OWNER') {
      if (req.user.role !== 'OWNER') {
        return res.status(403).json({ message: 'Only owners can delete administrators' });
      }
    }
    
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// @desc    Update a user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { firstName, lastName, email, password, role, permissions, avatarUrl, position, monthlySalary, isActive } = req.body;
    if (email) email = email.toLowerCase().trim();


    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const allowedTitles = ['Strategist', 'Manager', 'Scriptwriter', 'Video Editor', 'Graphic Designer', 'Sales', 'Sales Specialist', 'Marketing'];
    if (role === 'TEAM' && position && !allowedTitles.includes(position) && position !== 'Custom') {
      // Allow valid title or custom string
    }

    const data = { firstName, lastName, email, role, permissions, avatarUrl, isActive };

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data
    });

    // Update position/salary if team/admin
    if (role === 'TEAM' || role === 'ADMIN') {
      await prisma.teamMember.upsert({
        where: { userId: id },
        create: { 
          userId: id, 
          position, 
          company: req.body.company,
          phone: req.body.phone,
          notionLink: req.body.notionLink,
          telegram: req.body.telegram,
          managedChannels: req.body.managedChannels ? parseInt(req.body.managedChannels) : 0,
          healthScore: req.body.healthScore || 'GOOD',
          internalNotes: req.body.internalNotes,
          monthlySalary: req.body.monthlySalary ? parseFloat(req.body.monthlySalary) : 0 
        },
        update: { 
          position, 
          company: req.body.company,
          phone: req.body.phone,
          notionLink: req.body.notionLink,
          telegram: req.body.telegram,
          managedChannels: req.body.managedChannels ? parseInt(req.body.managedChannels) : undefined,
          healthScore: req.body.healthScore,
          internalNotes: req.body.internalNotes,
          monthlySalary: req.body.monthlySalary ? parseFloat(req.body.monthlySalary) : undefined 
        }
      });
    }

    res.json({
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Grant chat access to a specific client for a team member
// @route   PATCH /api/users/:id/grant-chat
// @access  Private/Admin
const grantChatAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { chatId } = req.body; // Can be a clientId, projectId, or group id

    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const permissionTag = `chat:${chatId}`;
    if (user.permissions.includes(permissionTag)) {
      return res.status(400).json({ message: 'User already has access to this chat' });
    }

    // Check if it's a project
    const project = await prisma.project.findUnique({ 
      where: { id: chatId },
      include: { teamMembers: true }
    });

    if (project) {
      // Ensure the TeamMember record exists before connecting
      let teamMember = await prisma.teamMember.findUnique({ where: { userId: id } });
      if (!teamMember) {
        teamMember = await prisma.teamMember.create({ data: { userId: id, position: 'عضو فريق' } });
      }

      await prisma.project.update({
        where: { id: chatId },
        data: {
          teamMembers: {
            connect: { id: teamMember.id }
          }
        }
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        permissions: {
          set: [...user.permissions, permissionTag]
        }
      }
    });

    res.json({ message: 'Chat access granted successfully', permissions: updatedUser.permissions });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset user password
// @route   POST /api/users/:id/reset-password
// @access  Private/Admin
const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get contacts for client (Owner + PMs)
// @route   GET /api/users/client-contacts
// @access  Private (Client)
const getClientContacts = async (req, res, next) => {
  try {
    if (req.user.role !== 'CLIENT') {
      return res.status(403).json({ message: 'Only clients can access this route' });
    }

    // 1. Get Owner for "Support"
    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true }
    });

    // 2. Get Project Managers for active projects
    const clientProjects = await prisma.project.findMany({
      where: { clientId: req.user.clientInfo?.id },
      include: {
        teamMembers: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true }
            }
          }
        }
      }
    });

    const pms = [];
    clientProjects.forEach(project => {
      project.teamMembers.forEach(tm => {
        // Find PM or team members
        if (!pms.find(p => p.id === tm.user.id)) {
          pms.push({ ...tm.user, projectNames: [project.name] });
        } else {
          const existing = pms.find(p => p.id === tm.user.id);
          existing.projectNames.push(project.name);
        }
      });
    });

    res.json({ support: owner, projectManagers: pms });
  } catch (error) {
    next(error);
  }
};

// @desc    Get admin/owner contacts for team members
// @route   GET /api/users/team-contacts
// @access  Private (Team)
const getTeamContacts = async (req, res, next) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'OWNER'] } },
      select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true }
    });
    res.json(admins);
  } catch (error) {
    next(error);
  }
};



// @desc    Get real-time presence of all active users
// @route   GET /api/users/presence
// @access  Private
const getPresenceUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        isOnline: true,
        lastActiveAt: true
      }
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
};

// @desc    Get specific user performance metrics
// @route   GET /api/users/:id/performance
// @access  Private
const getUserPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        teamMemberInfo: {
          include: {
            tasks: {
              include: {
                project: { select: { id: true, name: true } }
              }
            }
          }
        },
        _count: {
          select: {
            messagesSent: true,
            createdLeads: true,
            activityLogs: true
          }
        }
      }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const tasks = user.teamMemberInfo?.tasks || [];
    const performance = calculateTeamPerformance({
      tasks,
      lastActiveAt: user.lastActiveAt,
      isOnline: user.isOnline,
      messagesCount: user._count?.messagesSent || 0,
      leadsCount: user._count?.createdLeads || 0,
      activityCount: user._count?.activityLogs || 0,
      position: user.teamMemberInfo?.position
    });

    res.json({
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      position: user.teamMemberInfo?.position,
      performance,
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        deadline: t.deadline,
        projectName: t.project?.name,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }))
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  grantChatAccess,
  getClientContacts,
  getTeamContacts,
  getPresenceUsers,
  getUserPerformance
};


