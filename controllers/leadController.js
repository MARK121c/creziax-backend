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

const parseDate = (val) => {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const parseNum = (val) => {
  if (val === '' || val === null || val === undefined) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
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

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'اسم العميل مطلوب (Lead name is required)' });
    }

    const lead = await prisma.lead.create({
      data: {
        name: name.trim(),
        niche: niche?.trim() || null,
        nationality: nationality?.trim() || null,
        hasOtherBusiness: hasOtherBusiness || null,
        followersCount: followersCount ? String(followersCount).trim() : null,
        videosCount: videosCount ? String(videosCount).trim() : null,
        startDate: parseDate(startDate),
        avgViews: avgViews ? String(avgViews).trim() : null,
        proposedPrice: parseNum(proposedPrice),
        meetingDate: parseDate(meetingDate),
        meetingTime: meetingTime?.trim() || null,
        meetingLink: meetingLink?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        channelUrl: channelUrl?.trim() || null,
        notes: notes?.trim() || null,
        status: status || 'NEW',
        createdById: req.user.id,
        assignedToId: (assignedToId && assignedToId.trim() !== '') ? assignedToId : req.user.id
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
    if (name !== undefined) data.name = name.trim();
    if (niche !== undefined) data.niche = niche?.trim() || null;
    if (nationality !== undefined) data.nationality = nationality?.trim() || null;
    if (hasOtherBusiness !== undefined) data.hasOtherBusiness = hasOtherBusiness || null;
    if (followersCount !== undefined) data.followersCount = followersCount ? String(followersCount).trim() : null;
    if (videosCount !== undefined) data.videosCount = videosCount ? String(videosCount).trim() : null;
    if (startDate !== undefined) data.startDate = parseDate(startDate);
    if (avgViews !== undefined) data.avgViews = avgViews ? String(avgViews).trim() : null;
    if (proposedPrice !== undefined) data.proposedPrice = parseNum(proposedPrice);
    if (meetingDate !== undefined) data.meetingDate = parseDate(meetingDate);
    if (meetingTime !== undefined) data.meetingTime = meetingTime?.trim() || null;
    if (meetingLink !== undefined) data.meetingLink = meetingLink?.trim() || null;
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (channelUrl !== undefined) data.channelUrl = channelUrl?.trim() || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (status !== undefined) data.status = status;
    if (assignedToId !== undefined) data.assignedToId = (assignedToId && assignedToId.trim() !== '') ? assignedToId : null;

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
