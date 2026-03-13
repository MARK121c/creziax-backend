// Controllers for Client resource
const prisma = require('../prismaClient');

// Get all clients
const getClients = async (req, res, next) => {
  try {
    const clients = await prisma.client.findMany({ include: { user: true, projects: true, invoices: true } });
    res.json(clients);
  } catch (err) {
    next(err);
  }
};

// Get single client by ID
const getClient = async (req, res, next) => {
  const { id } = req.params;
  try {
    const client = await prisma.client.findUnique({ where: { id }, include: { user: true, projects: true, invoices: true } });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (err) {
    next(err);
  }
};

// Create a new client (requires a linked user)
const createClient = async (req, res, next) => {
  const { userId, company, phone } = req.body;
  try {
    const client = await prisma.client.create({ data: { user: { connect: { id: userId } }, company, phone } });
    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
};

// Update client
const updateClient = async (req, res, next) => {
  const { id } = req.params;
  const { company, phone } = req.body;
  try {
    const client = await prisma.client.update({ where: { id }, data: { company, phone } });
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
