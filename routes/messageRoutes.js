const express = require('express');
const router = express.Router();
const { getMessages, sendMessage, getThreads } = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getMessages)
  .post(sendMessage);

router.get('/threads', authorize('ADMIN'), getThreads);

module.exports = router;
