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
  getTeamContacts
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Client specific route (Requires authentication but not ADMIN)
router.get('/client-contacts', protect, getClientContacts);

// Team specific route (Requires authentication, accessible by Team members)
router.get('/team-contacts', protect, getTeamContacts);

// All user routes require authentication and ADMIN role
router.use(protect);
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

module.exports = router;
