const express = require('express');
const router = express.Router();
const { getProjects, getProject, createProject, updateProject, deleteProject } = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(authorize('ADMIN'), createProject);

router.route('/:id')
  .get(getProject)
  .put(authorize('ADMIN'), updateProject)
  .delete(authorize('ADMIN'), deleteProject);

module.exports = router;
