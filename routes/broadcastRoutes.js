const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getActiveBroadcasts, createBroadcast, updateBroadcast, deleteBroadcast } = require('../controllers/broadcastController');

const router = express.Router();

router.route('/')
  .get(protect, getActiveBroadcasts)
  .post(protect, admin, createBroadcast);

router.route('/:id')
  .put(protect, admin, updateBroadcast)
  .delete(protect, admin, deleteBroadcast);

module.exports = router;
