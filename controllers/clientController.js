// Controllers for Client resource
const prisma = require('../prismaClient');

// Get all clients
const getClients = async (req, res, next) => {
  try {
    console.log(`[DEBUG] GET /api/clients - User: ${req.user.role} (${req.user.id})`);
    const clients = await prisma.client.findMany({ 
      include: { 
        user: true, 
        projects: true, 
        invoices: {
          where: { status: 'PAID' },
          select: { amount: true }
        } 
      } 
    });
    console.log(`[DEBUG] Found ${clients.length} clients`);
    
    const clientsWithTotal = clients.map(client => {
      const totalPaid = client.invoices.reduce((sum, inv) => sum + inv.amount, 0);
      return { ...client, totalPaid };
    });

    res.json(clientsWithTotal);
  } catch (err) {
    console.error('[DEBUG] GET CLIENTS ERROR:', err);
    next(err);
  }
};

// Get single client by ID
const getClient = async (req, res, next) => {
  const { id } = req.params;
  try {
    const client = await prisma.client.findUnique({ 
      where: { id }, 
      include: { 
        user: true, 
        projects: true, 
        invoices: {
          where: { status: 'PAID' },
          select: { amount: true }
        } 
      } 
    });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    
    // Role Enforcement: CLIENT can only see their own client record
    if (req.user.role === 'CLIENT' && client.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized for this client data' });
    }

    const totalPaid = client.invoices.reduce((sum, inv) => sum + inv.amount, 0);
    res.json({ ...client, totalPaid });
  } catch (err) {
    next(err);
  }
};

// Create a new client (requires a linked user)
const createClient = async (req, res, next) => {
  const { userId, company, phone, tier, logoUrl, notionLink, telegram, managedChannels, contractStartDate, contractEndDate, healthScore, internalNotes, preferredCurrency } = req.body;
  try {
    const client = await prisma.client.create({ 
      data: { 
        user: { connect: { id: userId } }, 
        company, 
        phone,
        tier: tier || 'REGULAR',
        logoUrl,
        notionLink,
        telegram,
        managedChannels: managedChannels ? parseInt(managedChannels) : 0,
        contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
        contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
        healthScore: healthScore || 'GOOD',
        internalNotes,
        preferredCurrency: preferredCurrency || 'USD'
      } 
    });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
};

// Update client
const updateClient = async (req, res, next) => {
  const { id } = req.params;
  const { company, phone, tier, isVip, logoUrl, notionLink, telegram, managedChannels, contractStartDate, contractEndDate, healthScore, internalNotes, preferredCurrency } = req.body;
  try {
    const data = { 
      company, 
      phone, 
      tier, 
      isVip, 
      logoUrl, 
      notionLink,
      telegram,
      contractStartDate: contractStartDate ? new Date(contractStartDate) : undefined,
      contractEndDate: contractEndDate ? new Date(contractEndDate) : undefined,
      healthScore,
      internalNotes,
      preferredCurrency
    };
    if (managedChannels !== undefined) {
      data.managedChannels = parseInt(managedChannels);
    }
    // Optional: Update linked user data
    const { firstName, lastName, email, password } = req.body;
    if (firstName || lastName || email || (password && password.trim() !== '')) {
      const userData = { firstName, lastName, email };
      if (password && password.trim() !== '') {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(password, salt);
      }
      
      const clientRecord = await prisma.client.findUnique({ where: { id } });
      if (clientRecord) {
        await prisma.user.update({
          where: { id: clientRecord.userId },
          data: userData
        });
      }
    }

    const client = await prisma.client.update({ 
      where: { id }, 
      data
    });
    res.json(client);
  } catch (err) {
    next(err);
  }
};

// Delete client
const deleteClient = async (req, res, next) => {
  const { id } = req.params;
  try {
    await prisma.client.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { getClients, getClient, createClient, updateClient, deleteClient };
