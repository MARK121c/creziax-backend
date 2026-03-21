const prisma = require('../prismaClient');

// @desc    Get all workspaces (projects) with basic stats
// @route   GET /api/workspaces
// @access  Private/Admin
exports.getWorkspaces = async (req, res) => {
  try {
    const workspaces = await prisma.project.findMany({
      include: {
        client: {
          select: {
            id: true,
            company: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            }
          }
        },
        teamMembers: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            tasks: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: workspaces
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get single workspace details with stats
// @route   GET /api/workspaces/:id
// @access  Private/Admin
exports.getWorkspace = async (req, res) => {
  try {
    const workspace = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          include: {
            user: true
          }
        },
        teamMembers: {
          include: {
            user: true
          }
        },
        phases: {
          orderBy: {
            startDate: 'desc'
          },
          include: {
            invoice: true
          }
        }
      }
    });

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    // Calculate Stats
    const totalTasks = await prisma.task.count({ where: { projectId: workspace.id } });
    const completedTasks = await prisma.task.count({ 
      where: { 
        projectId: workspace.id,
        status: 'DELIVERED'
      } 
    });
    const pendingTasks = totalTasks - completedTasks;

    // Team load (tasks per team member in this project)
    const teamLoad = workspace.teamMembers.map(async (member) => {
      const activeTasks = await prisma.task.count({
        where: {
          projectId: workspace.id,
          assignedToId: member.id,
          NOT: { status: 'DELIVERED' }
        }
      });
      return {
        id: member.id,
        name: `${member.user.firstName} ${member.user.lastName}`,
        activeTasks
      };
    });

    const resolvedTeamLoad = await Promise.all(teamLoad);

    res.json({
      success: true,
      data: {
        ...workspace,
        stats: {
          totalTasks,
          completedTasks,
          pendingTasks,
          teamLoad: resolvedTeamLoad
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get tasks for a specific phase (Lazy Loading)
// @route   GET /api/workspaces/phases/:phaseId/tasks
// @access  Private/Admin
exports.getPhaseTasks = async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { phaseId: req.params.phaseId },
      include: {
        assignedTo: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update task (Inline Editing)
// @route   PUT /api/workspaces/tasks/:id
// @access  Private/Admin
exports.updateWorkspaceTask = async (req, res) => {
  try {
    const { status, assignedToId, title, deadline, reviewUrl, privateNotes } = req.body;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        status,
        assignedToId,
        title,
        deadline: deadline ? new Date(deadline) : undefined,
        reviewUrl,
        privateNotes
      },
      include: {
        assignedTo: {
          include: {
            user: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Create new Phase (Month)
// @route   POST /api/workspaces/:projectId/phases
// @access  Private/Admin
exports.createPhase = async (req, res) => {
  try {
    const { name, startDate, endDate, amount } = req.body;
    const { projectId } = req.params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true }
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Create Phase
    const phase = await prisma.phase.create({
      data: {
        name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        projectId
      }
    });

    // Automatically create Invoice if amount is provided
    if (amount) {
      const invoiceNumber = `INV-${Date.now()}`;
      await prisma.invoice.create({
        data: {
          invoiceNumber,
          service: `Monthly Retainer - ${name}`,
          amount: parseFloat(amount),
          status: 'PENDING',
          dueDate: endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          clientId: project.clientId,
          phaseId: phase.id
        }
      });
    }

    res.status(201).json({
      success: true,
      data: phase
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Create new Task in Phase
// @route   POST /api/workspaces/phases/:phaseId/tasks
// @access  Private/Admin
exports.createWorkspaceTask = async (req, res) => {
  try {
    const { title, description, deadline, assignedToId } = req.body;
    const { phaseId } = req.params;

    const phase = await prisma.phase.findUnique({
      where: { id: phaseId }
    });

    if (!phase) {
      return res.status(404).json({ success: false, message: 'Phase not found' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || '{}',
        deadline: deadline ? new Date(deadline) : null,
        status: 'IDEA',
        projectId: phase.projectId,
        phaseId: phase.id,
        assignedToId: assignedToId || null
      }
    });

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Delete Phase
// @route   DELETE /api/workspaces/phases/:id
// @access  Private/Admin
exports.deletePhase = async (req, res) => {
  try {
    await prisma.phase.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Phase deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Delete Task
// @route   DELETE /api/workspaces/tasks/:id
// @access  Private/Admin
exports.deleteWorkspaceTask = async (req, res) => {
  try {
    await prisma.task.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
