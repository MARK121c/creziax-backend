// Controllers for Task resource
const prisma = require('../prismaClient');

// Get all tasks
const getTasks = async (req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({ include: { project: true, assignedTo: true } });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
};

// Get single task by ID
const getTask = async (req, res, next) => {
  const { id } = req.params;
  try {
    const task = await prisma.task.findUnique({ where: { id }, include: { project: true, assignedTo: true } });
    if (!task) return res.status(404).json({ message: 'Task not found' });
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
