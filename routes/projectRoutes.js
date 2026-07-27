const express = require('express');
const router = express.Router();
const { getProjects, getProject, createProject, updateProject, deleteProject, downloadContractPDF, archiveProject, restoreProject, getArchivedProjects } = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(authorize('ADMIN'), createProject);

// v19.5 Smart Archive routes (before /:id to avoid conflicts)
router.get('/archived/all', authorize('ADMIN'), getArchivedProjects);

router.route('/:id')
  .get(getProject)
  .put(authorize('ADMIN'), updateProject)
  .delete(authorize('ADMIN'), deleteProject);

router.get('/:id/download', downloadContractPDF);
router.patch('/:id/archive', authorize('ADMIN'), archiveProject);
router.patch('/:id/restore', authorize('ADMIN'), restoreProject);

module.exports = router;
