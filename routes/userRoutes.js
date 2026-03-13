const express = require('express');
const router = express.Router();
const { getUsers, createUser, deleteUser } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// All user routes require authentication and ADMIN role
router.use(protect);
router.use(authorize('ADMIN'));

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .delete(deleteUser);

module.exports = router;
