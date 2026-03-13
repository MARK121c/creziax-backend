// Controllers for Project resource
const prisma = require('../prismaClient');

// Get all projects
const getProjects = async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({ include: { client: true, tasks: true, files: true } });
    res.json(projects);
  } catch (err) {
    next(err);
  }
};

// Get single project by ID
const getProject = async (req, res, next) => {
  const { id } = req.params;
  try {
    const project = await prisma.project.findUnique({ where: { id }, include: { client: true, tasks: true, files: true } });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) {
    next(err);
  }
};

// Create a new project
const createProject = async (req, res, next) => {
  const { name, description, clientId, status } = req.body;
  try {
    const project = await prisma.project.create({ data: { name, description, clientId, status } });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

// Update project
const updateProject = async (req, res, next) => {
  const { id } = req.params;
  const { name, description, status } = req.body;
  try {
    const project = await prisma.project.update({ where: { id }, data: { name, description, status } });
    res.json(project);
  } catch (err) {
    next(err);
  }
};

// Delete project
const deleteProject = async (req, res, next) => {
  const { id } = req.params;
  try {
    await prisma.project.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject };
