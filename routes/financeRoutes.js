const express = require('express');
const router = express.Router();
const { getFinanceStats } = require('../controllers/financeController');
const { protect, admin } = require('../middleware/auth');

// v19.5 Agency OS: Admin Finance Overview
router.get('/stats', protect, admin, getFinanceStats);

module.exports = router;
