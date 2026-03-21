const prisma = require('../prismaClient');

// Get all contracts with relations
const getContracts = async (req, res, next) => {
  try {
    let where = {};
    if (req.user.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user.id } });
      if (!client) return res.status(404).json({ message: 'Client record not found' });
      where = { clientId: client.id };
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        client: {
          include: { user: true }
        },
        member: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(contracts);
  } catch (err) {
    next(err);
  }
};

// GET /api/contracts/:id
const getContract = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { 
        client: { include: { user: true } },
        member: true 
      }
    });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    if (req.user.role === 'CLIENT' && contract.client.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized for this contract' });
    }
    res.json(contract);
  } catch (err) {
    next(err);
  }
};

// Create a new contract entry
const createContract = async (req, res, next) => {
  const { title, date, startDate, endDate, clientId, memberId, pdfUrl } = req.body;
  try {
    const contract = await prisma.contract.create({
      data: {
        title,
        date: date || new Date().toLocaleDateString('ar-EG'),
        startDate,
        endDate,
        pdfUrl,
        clientId: (clientId && clientId.trim()) ? clientId : null,
        memberId: (memberId && memberId.trim()) ? memberId : null,
      },
      include: {
        client: { include: { user: true } },
        member: true
      }
    });
    res.status(201).json(contract);
  } catch (err) {
    next(err);
  }
};

// Update an existing contract
const updateContract = async (req, res, next) => {
  const { id } = req.params;
  const { title, date, startDate, endDate, clientId, memberId, pdfUrl } = req.body;
  try {
    const data = {
      ...(title !== undefined && { title }),
      ...(date !== undefined && { date }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      ...(pdfUrl !== undefined && { pdfUrl }),
    };

    if (clientId !== undefined) {
      data.clientId = (clientId && clientId.trim()) ? clientId : null;
    }
    if (memberId !== undefined) {
      data.memberId = (memberId && memberId.trim()) ? memberId : null;
    }

    const contract = await prisma.contract.update({
      where: { id },
      data,
      include: {
        client: { include: { user: true } },
        member: true
      }
    });
    res.json(contract);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/contracts/:id
const deleteContract = async (req, res, next) => {
  try {
    await prisma.contract.delete({ where: { id: req.params.id } });
    res.json({ message: 'Contract record deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getContracts, getContract, createContract, updateContract, deleteContract };
