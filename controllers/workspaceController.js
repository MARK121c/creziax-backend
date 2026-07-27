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

// @desc    Get workspaces for logged-in CLIENT with phases and tasks
// @route   GET /api/workspaces/client/my
// @access  Private/Client
exports.getClientWorkspaces = async (req, res) => {
  try {
    // Find the client profile for this user
    const clientProfile = await prisma.client.findUnique({
      where: { userId: req.user.id }
    });

    if (!clientProfile) {
      return res.json({ success: true, data: [] });
    }

    const workspaces = await prisma.project.findMany({
      where: { clientId: clientProfile.id },
      include: {
        phases: {
          orderBy: { startDate: 'asc' },
          include: {
            tasks: {
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: workspaces });
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

// Helper: Evaluate stage timers (Team deadline lockout & Client Auto-Approval)
const evaluateStageTimers = (description, taskCreatedAt) => {
  if (!description || description === 'null') return description;
  try {
    const meta = JSON.parse(description);
    if (!meta || typeof meta !== 'object') return description;

    let modified = false;
    const stages = ['script', 'edit', 'thumbnail', 'publish'];
    const now = Date.now();

    stages.forEach(sKey => {
      const stage = meta[sKey];
      if (!stage || typeof stage !== 'object') return;

      // 1. Team Deadline Expiry Check
      if (!stage.teamDeadlineExpired && !stage.link && !stage.datetime) {
        const teamHours = Number(stage.teamDeadlineHours) || 24;
        const startTime = stage.teamDeadlineStartedAt
          ? new Date(stage.teamDeadlineStartedAt).getTime()
          : new Date(taskCreatedAt || Date.now()).getTime();
        
        if (startTime + teamHours * 3600 * 1000 <= now) {
          stage.teamDeadlineExpired = true;
          stage.penaltyApplied = true;
          modified = true;
        }
      }

      // 2. Client Auto-Approval Timer Check
      if (stage.visible && stage.clientTimerStartedAt && (stage.approvalStatus === 'PENDING' || stage.approvalStatus === 'REVISION_DONE')) {
        const reviewHours = Number(stage.clientReviewHours) || 12;
        const startTime = new Date(stage.clientTimerStartedAt).getTime();

        if (startTime + reviewHours * 3600 * 1000 <= now) {
          stage.approvalStatus = 'AUTO_APPROVED';
          modified = true;
        }
      }
    });

    return modified ? JSON.stringify(meta) : description;
  } catch (_) {
    return description;
  }
};

// @desc    Get tasks for a specific phase (Lazy Loading)
// @route   GET /api/workspaces/phases/:phaseId/tasks
// @access  Private/Admin
exports.getPhaseTasks = async (req, res) => {
  try {
    const rawTasks = await prisma.task.findMany({
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

    // Evaluate stage timers dynamically on fetch
    const tasks = await Promise.all(rawTasks.map(async (t) => {
      const evaluatedDesc = evaluateStageTimers(t.description, t.createdAt);
      if (evaluatedDesc !== t.description) {
        // Background sync to DB
        try {
          await prisma.task.update({ where: { id: t.id }, data: { description: evaluatedDesc } });
        } catch (_) {}
        return { ...t, description: evaluatedDesc };
      }
      return t;
    }));

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update task (Inline Editing) — v21 supports description JSON for video workflow stages
// @route   PUT /api/workspaces/tasks/:id
// @access  Private/Admin
exports.updateWorkspaceTask = async (req, res) => {
  try {
    const { status, assignedToId, title, deadline, reviewUrl, privateNotes, description } = req.body;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(title !== undefined && { title }),
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        ...(reviewUrl !== undefined && { reviewUrl }),
        ...(privateNotes !== undefined && { privateNotes }),
        ...(description !== undefined && { description }),
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

// @desc    Toggle a single stage's client visibility (Admin only)
// @route   PATCH /api/workspaces/tasks/:id/visibility
// @access  Private/Admin (admin.mark@creziax.com only enforced on frontend; double-checked here by role)
exports.toggleStageVisibility = async (req, res) => {
  try {
    const { stage, visible } = req.body;
    // stage must be one of: script | edit | thumbnail | publish
    const validStages = ['script', 'edit', 'thumbnail', 'publish'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ success: false, message: 'Invalid stage name' });
    }

    // Fetch current task
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Parse existing description JSON safely
    let meta = {};
    try {
      if (task.description && task.description !== 'null') {
        meta = JSON.parse(task.description);
      }
    } catch (_) { meta = {}; }

    // Ensure the stage object exists
    if (!meta[stage] || typeof meta[stage] !== 'object') {
      meta[stage] = {};
    }

    // Patch ONLY the visible field for this stage and start timer if making visible
    meta[stage].visible = !!visible;
    if (visible && (!meta[stage].clientTimerStartedAt || meta[stage].approvalStatus === 'REVISION_DONE')) {
      meta[stage].clientTimerStartedAt = new Date().toISOString();
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { description: JSON.stringify(meta) },
      include: {
        assignedTo: {
          include: { user: true }
        }
      }
    });

    res.json({ success: true, data: updated });
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

    const io = req.app.get('io');
    if (io) io.emit('workspace_updated', { userId: req.user.id });

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
    const io = req.app.get('io');
    if (io) io.emit('workspace_updated', { userId: req.user.id });
    
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Submit client feedback (Approve or Request Revisions) for a specific stage
// @route   PATCH /api/workspaces/tasks/:id/feedback
// @access  Private/Client
exports.submitClientFeedback = async (req, res) => {
  try {
    const { stage, approvalStatus, clientNotes } = req.body;

    // Validate stage
    const validStages = ['script', 'edit', 'thumbnail', 'publish'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ success: false, message: 'Invalid stage name' });
    }

    // Validate approval status
    const validStatuses = ['PENDING', 'APPROVED', 'REVISION_REQUESTED'];
    if (!validStatuses.includes(approvalStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid approval status' });
    }

    // Fetch current task
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Parse existing description JSON safely
    let meta = {};
    try {
      if (task.description && task.description !== 'null') {
        meta = JSON.parse(task.description);
      }
    } catch (_) { meta = {}; }

    // Ensure the stage object exists
    if (!meta[stage] || typeof meta[stage] !== 'object') {
      meta[stage] = {};
    }

    // Only allow feedback on visible stages
    if (!meta[stage].visible) {
      return res.status(403).json({ success: false, message: 'This stage is not yet released for review' });
    }

    // Update feedback fields only
    meta[stage].approvalStatus = approvalStatus;
    meta[stage].clientNotes = clientNotes || '';

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { description: JSON.stringify(meta) },
      include: {
        assignedTo: {
          include: { user: true }
        }
      }
    });

    // Notify via socket
    const io = req.app.get('io');
    if (io) io.emit('task_updated', { taskId: task.id, stage, approvalStatus });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
