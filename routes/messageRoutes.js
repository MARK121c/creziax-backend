const express = require('express');
const router = express.Router();
const { 
  getMessages, 
  sendMessage, 
  getThreads, 
  createTeamGroup, 
  getTeamGroups,
  clearAllMessages,
  deleteTeamGroup,
  removeGroupMember,
  addGroupMember,
  markAsRead,
  togglePinMessage,
  deleteMessage,
  markAllAsRead,
  getUnreadCount
} = require('../controllers/messageController');

const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/unread-count', getUnreadCount);

router.route('/')
  .get(getMessages)
  .post(sendMessage);

router.get('/threads', getThreads);
router.delete('/clear', clearAllMessages);

router.delete('/:id', deleteMessage); // v17.2/v17.5.3
router.patch('/:id/pin', togglePinMessage); // NEW

router.put('/mark-all-read', markAllAsRead); // v17.5.3
router.post('/mark-read', markAsRead); // NEW

router.route('/groups')
  .get(getTeamGroups)
  .post(createTeamGroup);

router.delete('/groups/:id', deleteTeamGroup);
router.post('/groups/:id/members', addGroupMember);
router.delete('/groups/:id/members/:userId', removeGroupMember);

module.exports = router;
