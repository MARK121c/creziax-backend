// Controllers for Task resource
const prisma = require('../prismaClient');

// Get all tasks
const getTasks = async (req, res, next) => {
  try {
    let where = {};
    if (req.user.role === 'CLIENT') {
      const client = await prisma.client.findUnique({ where: { userId: req.user.id } });
      if (!client) return res.status(404).json({ message: 'Client not found' });
      where = { project: { clientId: client.id } };
    }
    const tasks = await prisma.task.findMany({ 
      where, 
      include: { 
        project: true, 
        assignedTo: {
          include: { user: true }
        } 
      } 
    });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
};

// Get single task by ID
const getTask = async (req, res, next) => {
  const { id } = req.params;
  try {
    const task = await prisma.task.findUnique({ 
      where: { id }, 
      include: { 
        project: { include: { client: true } }, 
        assignedTo: {
          include: { user: true }
        } 
      } 
    });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.user.role === 'CLIENT' && task.project.client.userId !== req.user.id) {
       return res.status(403).json({ message: 'Not authorized for this task' });
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
};

// Create a new task
const createTask = async (req, res, next) => {
  const { title, description, deadline, projectId, assignedToId, status } = req.body;
  try {
    const task = await prisma.task.create({ data: { title, description, deadline, projectId, assignedToId, status } });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
};

// Update task
const updateTask = async (req, res, next) => {
  const { id } = req.params;
  const { title, description, deadline, status, assignedToId } = req.body;
  try {
    const task = await prisma.task.update({ where: { id }, data: { title, description, deadline, status, assignedToId } });
    const io = req.app.get('io');
    if (io) io.emit('task_updated', task);
    res.json(task);
  } catch (err) {
    next(err);
  }
};

// Delete task
const deleteTask = async (req, res, next) => {
  const { id } = req.params;
  try {
    await prisma.task.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { getTasks, getTask, createTask, updateTask, deleteTask };
