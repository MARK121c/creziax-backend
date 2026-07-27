const express = require('express');
const router = express.Router();
const { getNotifications, markRead, markAllRead, deleteAll } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getNotifications);
router.patch('/:id/read', markRead);
router.post('/mark-all-read', markAllRead);
router.delete('/', deleteAll);

module.exports = router;
