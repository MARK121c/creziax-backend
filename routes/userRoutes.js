const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  getUser, 
  createUser, 
  updateUser, 
  deleteUser, 
  resetPassword,
  grantChatAccess,
  getClientContacts,
  getTeamContacts,
  getPresenceUsers,
  getUserPerformance
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Presence & Contacts (All authenticated users)
router.get('/presence', getPresenceUsers);
router.get('/client-contacts', getClientContacts);
router.get('/team-contacts', getTeamContacts);
router.get('/:id/performance', getUserPerformance);

// All user management routes require ADMIN or OWNER role
router.use(authorize('ADMIN', 'OWNER'));

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

router.post('/:id/reset-password', resetPassword);
router.patch('/:id/grant-chat', grantChatAccess);

module.exports = router;
