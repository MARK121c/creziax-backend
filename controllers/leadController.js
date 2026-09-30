const prisma = require('../prismaClient');
const {
  getNotificationConfig,
  saveNotificationConfig,
  dispatchLeadNotification,
  sendTestNotification
} = require('../services/integrationNotificationService');

/**
 * @desc Get all CRM leads with metrics
 * @route GET /api/leads
 * @access Private (Admin, Owner, Team with Sales/CRM permission)
 */
const getLeads = async (req, res, next) => {
  try {
    const { status, search, assignedToId } = req.query;

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (assignedToId) {
      where.assignedToId = assignedToId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { niche: { contains: search, mode: 'insensitive' } },
        { nationality: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, allLeadsCount, wonCount, meetingCount, totalProposedValue] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true }
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'WON' } }),
      prisma.lead.count({ where: { status: 'MEETING_SCHEDULED' } }),
      prisma.lead.aggregate({
        _sum: { proposedPrice: true }
      })
    ]);

    const stats = {
      totalLeads: allLeadsCount,
      wonLeads: wonCount,
      meetingsScheduled: meetingCount,
      totalPipelineValue: totalProposedValue._sum.proposedPrice || 0,
      conversionRate: allLeadsCount > 0 ? ((wonCount / allLeadsCount) * 100).toFixed(1) : 0
    };

    res.json({ leads, stats });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get single CRM lead
 * @route GET /api/leads/:id
 */
const getLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true }
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.json(lead);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Create a new CRM lead and dispatch Telegram / WhatsApp notifications
 * @route POST /api/leads
 */
const createLead = async (req, res, next) => {
  try {
    const {
      name,
      niche,
      nationality,
      hasOtherBusiness,
      followersCount,
      videosCount,
      startDate,
      avgViews,
      proposedPrice,
      meetingDate,
      meetingTime,
      meetingLink,
      phone,
      email,
      channelUrl,
      notes,
      status,
      assignedToId
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'اسم العميل مطلوب (Lead name is required)' });
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        niche: niche || null,
        nationality: nationality || null,
        hasOtherBusiness: hasOtherBusiness || null,
        followersCount: followersCount ? String(followersCount) : null,
        videosCount: videosCount ? String(videosCount) : null,
        startDate: startDate ? new Date(startDate) : null,
        avgViews: avgViews ? String(avgViews) : null,
        proposedPrice: proposedPrice ? parseFloat(proposedPrice) : null,
        meetingDate: meetingDate ? new Date(meetingDate) : null,
        meetingTime: meetingTime || null,
        meetingLink: meetingLink || null,
        phone: phone || null,
        email: email || null,
        channelUrl: channelUrl || null,
        notes: notes || null,
        status: status || 'NEW',
        createdById: req.user.id,
        assignedToId: assignedToId || req.user.id
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true }
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true }
        }
      }
    });

    // Auto-dispatch notification asynchronously to Telegram / WhatsApp
    dispatchLeadNotification(lead, req.user).catch(err => {
      console.error('[CreateLead] Background notification error:', err.message);
    });

    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Update lead details
 * @route PUT /api/leads/:id
 */
const updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      niche,
      nationality,
      hasOtherBusiness,
      followersCount,
      videosCount,
      startDate,
      avgViews,
      proposedPrice,
      meetingDate,
      meetingTime,
      meetingLink,
      phone,
      email,
      channelUrl,
      notes,
      status,
      assignedToId
    } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (niche !== undefined) data.niche = niche;
    if (nationality !== undefined) data.nationality = nationality;
    if (hasOtherBusiness !== undefined) data.hasOtherBusiness = hasOtherBusiness;
    if (followersCount !== undefined) data.followersCount = String(followersCount);
    if (videosCount !== undefined) data.videosCount = String(videosCount);
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (avgViews !== undefined) data.avgViews = String(avgViews);
    if (proposedPrice !== undefined) data.proposedPrice = proposedPrice ? parseFloat(proposedPrice) : null;
    if (meetingDate !== undefined) data.meetingDate = meetingDate ? new Date(meetingDate) : null;
    if (meetingTime !== undefined) data.meetingTime = meetingTime;
    if (meetingLink !== undefined) data.meetingLink = meetingLink;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (channelUrl !== undefined) data.channelUrl = channelUrl;
    if (notes !== undefined) data.notes = notes;
    if (status !== undefined) data.status = status;
    if (assignedToId !== undefined) data.assignedToId = assignedToId;

    const updated = await prisma.lead.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true }
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true }
        }
      }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Delete lead
 * @route DELETE /api/leads/:id
 */
const deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.lead.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get Notification Settings (Telegram / WhatsApp)
 * @route GET /api/leads/settings/notification
 */
const getNotificationSettings = async (req, res, next) => {
  try {
    const config = await getNotificationConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Update Notification Settings
 * @route PUT /api/leads/settings/notification
 */
const updateNotificationSettings = async (req, res, next) => {
  try {
    const updated = await saveNotificationConfig(req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Send test notification to Telegram or WhatsApp
 * @route POST /api/leads/settings/test-notification
 */
const testNotificationEndpoint = async (req, res, next) => {
  try {
    const { type, ...payload } = req.body;
    const result = await sendTestNotification(type, payload);
    res.json({ success: true, message: 'تم إرسال الرسالة التجريبية بنجاح!', result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  getNotificationSettings,
  updateNotificationSettings,
  testNotificationEndpoint
};
