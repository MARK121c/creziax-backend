const express = require('express');
const router = express.Router();
const { 
  getWorkspaces, 
  getWorkspace, 
  getPhaseTasks, 
  updateWorkspaceTask, 
  createPhase, 
  deletePhase,
  createWorkspaceTask,
  deleteWorkspaceTask,
  toggleStageVisibility,
  submitClientFeedback
} = require('../controllers/workspaceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getWorkspaces);

router.route('/:id')
  .get(getWorkspace);

router.route('/:projectId/phases')
  .post(authorize('ADMIN'), createPhase);

router.route('/phases/:id')
  .delete(authorize('ADMIN'), deletePhase);

router.route('/phases/:phaseId/tasks')
  .get(getPhaseTasks)
  .post(authorize('ADMIN'), createWorkspaceTask);

router.route('/tasks/:id')
  .put(updateWorkspaceTask)
  .delete(authorize('ADMIN'), deleteWorkspaceTask);

// v21: Admin-only per-stage client visibility toggle
router.route('/tasks/:id/visibility')
  .patch(authorize('ADMIN'), toggleStageVisibility);

// v22: Client feedback — Approve or Request Revisions on visible stages
router.route('/tasks/:id/feedback')
  .patch(submitClientFeedback);

module.exports = router;
