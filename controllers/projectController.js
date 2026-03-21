// Controllers for Project resource
const prisma = require('../prismaClient');
const { generateContractPDF } = require('../services/pdfService');

// Get all projects
const getProjects = async (req, res, next) => {
  try {
    let where = {};
    if (req.user.role === 'CLIENT') {
      const clientRecord = await prisma.client.findUnique({ where: { userId: req.user.id } });
      if (!clientRecord) return res.status(404).json({ message: 'Client record not found' });
      where = { clientId: clientRecord.id };
    }
    const projects = await prisma.project.findMany({ where, include: { client: true, tasks: true, files: true } });
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

    if (req.user.role === 'CLIENT') {
      const clientRecord = await prisma.client.findUnique({ where: { userId: req.user.id } });
      if (!clientRecord || project.clientId !== clientRecord.id) {
        return res.status(403).json({ message: 'Not authorized for this project' });
      }
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
};

// Create a new project
const createProject = async (req, res, next) => {
  const { name, description, clientId, status, annualContractDate, notionUrl, driveUrl, brandUrl, logoUrl, clientChannelLink, teamMemberIds, brandColors, brandFonts } = req.body;
  try {
    const project = await prisma.project.create({ 
      data: { 
        name, 
        description, 
        clientId, 
        status,
        annualContractDate: annualContractDate ? new Date(annualContractDate) : null,
        notionUrl,
        driveUrl,
        brandUrl,
        brandColors,
        brandFonts,
        logoUrl,
        clientChannelLink,
        teamMembers: teamMemberIds ? {
          connect: teamMemberIds.map(id => ({ id }))
        } : undefined
      },
      include: { teamMembers: true, client: true }
    });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
};

// Update project
const updateProject = async (req, res, next) => {
  const { id } = req.params;
  const { name, description, status, annualContractDate, notionUrl, driveUrl, brandUrl, logoUrl, clientChannelLink, teamMemberIds, brandColors, brandFonts } = req.body;
  try {
    const project = await prisma.project.update({ 
      where: { id }, 
      data: { 
        name, 
        description, 
        status,
        annualContractDate: annualContractDate ? new Date(annualContractDate) : undefined,
        notionUrl,
        driveUrl,
        brandUrl,
        brandColors,
        brandFonts,
        logoUrl,
        clientChannelLink,
        teamMembers: teamMemberIds ? {
          set: teamMemberIds.map(id => ({ id }))
        } : undefined
      },
      include: { teamMembers: true, client: true }
    });
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

// Download contract
const downloadContractPDF = async (req, res, next) => {
  const { id } = req.params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { client: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } }
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (req.user.role === 'CLIENT') {
      const clientRecord = await prisma.client.findUnique({ where: { userId: req.user.id } });
      if (!clientRecord || project.clientId !== clientRecord.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    const fileName = `Contract-${project.name.replace(/\s+/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    generateContractPDF(project, res);
  } catch (err) {
    next(err);
  }
};

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject, downloadContractPDF };
