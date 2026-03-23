const prisma = require('../prismaClient');

// Get all tickets (Admin/Owner) or client tickets
const getTickets = async (req, res, next) => {
  try {
    let where = {};
    if (req.user.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user.id } });
      where = { clientId: client.id };
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { include: { user: { select: { firstName: true, lastName: true } } } },
        assignedStaff: { select: { firstName: true, lastName: true } },
        _count: { select: { messages: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};

const getTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        client: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        assignedStaff: { select: { firstName: true, lastName: true, avatarUrl: true } },
        messages: {
          include: { sender: { select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    
    // Auth check
    if (req.user.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user.id } });
      if (ticket.clientId !== client.id) return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

const createTicket = async (req, res, next) => {
  try {
    const { title, description, priority } = req.body;
    const client = await prisma.client.findUnique({ where: { userId: req.user.id } });

    if (!client) return res.status(400).json({ message: 'Client profile required to open tickets' });

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        clientId: client.id
      }
    });

    const io = req.app.get('io');
    if (io) io.emit('new_ticket', ticket);

    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
};

const updateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedStaffId } = req.body;

    // Only Admin/Owner can assign or change status significantly
    if (req.user.role === 'CLIENT' && (assignedStaffId || status === 'CLOSED')) {
       // Clients can maybe close their own? For now restrict to staff for control.
       return res.status(403).json({ message: 'Only staff can update ticket properties' });
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: { status, priority, assignedStaffId }
    });

    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

module.exports = { getTickets, getTicket, createTicket, updateTicket };
