const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('OWNER', 'ADMIN'), activityController.getRecentActivity);

module.exports = router;
