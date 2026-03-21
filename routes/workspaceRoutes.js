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
  deleteWorkspaceTask
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
  .put(authorize('ADMIN'), updateWorkspaceTask)
  .delete(authorize('ADMIN'), deleteWorkspaceTask);

module.exports = router;
