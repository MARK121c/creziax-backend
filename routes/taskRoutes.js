const express = require('express');
const router = express.Router();
const { getTasks, getTask, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getTasks)
  .post(authorize('ADMIN'), createTask);

router.route('/:id')
  .get(getTask)
  .put(authorize('ADMIN', 'TEAM'), updateTask)
  .delete(authorize('ADMIN'), deleteTask);

module.exports = router;
