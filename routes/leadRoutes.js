const express = require('express');
const router = express.Router();
const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  getNotificationSettings,
  updateNotificationSettings,
  testNotificationEndpoint
} = require('../controllers/leadController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Settings routes (Admin/Owner only)
router.route('/settings/notification')
  .get(authorize('ADMIN', 'OWNER'), getNotificationSettings)
  .put(authorize('ADMIN', 'OWNER'), updateNotificationSettings);

router.post('/settings/test-notification', authorize('ADMIN', 'OWNER'), testNotificationEndpoint);

// Leads CRUD
router.route('/')
  .get(getLeads)
  .post(createLead);

router.route('/:id')
  .get(getLead)
  .put(updateLead)
  .delete(authorize('ADMIN', 'OWNER'), deleteLead);

module.exports = router;
