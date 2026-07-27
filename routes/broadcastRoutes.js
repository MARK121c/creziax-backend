const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getActiveBroadcasts, createBroadcast, updateBroadcast, deleteBroadcast } = require('../controllers/broadcastController');

const admin = authorize('ADMIN');

const router = express.Router();

router.route('/')
  .get(protect, getActiveBroadcasts)
  .post(protect, admin, createBroadcast);

router.route('/:id')
  .put(protect, admin, updateBroadcast)
  .delete(protect, admin, deleteBroadcast);

module.exports = router;
