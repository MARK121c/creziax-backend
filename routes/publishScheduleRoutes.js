const express = require('express');
const router = express.Router();
const { getPublishSchedules, createPublishSchedule, updatePublishSchedule, deletePublishSchedule } = require('../controllers/publishScheduleController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getPublishSchedules)
  .post(authorize('ADMIN', 'OWNER'), createPublishSchedule);

router.route('/:id')
  .put(authorize('ADMIN', 'OWNER'), updatePublishSchedule)
  .delete(authorize('ADMIN', 'OWNER'), deletePublishSchedule);

module.exports = router;
