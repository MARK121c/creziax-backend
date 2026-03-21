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
  removeGroupMember
} = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getMessages)
  .post(sendMessage);

router.route('/groups')
  .get(getTeamGroups)
  .post(authorize('ADMIN', 'OWNER'), createTeamGroup);

router.delete('/groups/:id', authorize('ADMIN', 'OWNER'), deleteTeamGroup);
router.delete('/groups/:id/members/:userId', authorize('ADMIN', 'OWNER'), removeGroupMember);

router.delete('/clear', authorize('ADMIN', 'OWNER'), clearAllMessages);

router.get('/threads', authorize('ADMIN'), getThreads);

module.exports = router;
