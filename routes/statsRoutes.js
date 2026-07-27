const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { protect, authorize } = require('../middleware/auth');

router.get('/dashboard', protect, statsController.getDashboardStats);

// v20.0 SUPREME: Team-specific dashboard stats
router.get('/team-dashboard', protect, authorize('TEAM'), statsController.getTeamDashboardStats);

module.exports = router;
