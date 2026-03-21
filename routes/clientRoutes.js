const express = require('express');
const router = express.Router();
const { getClients, getClient, createClient, updateClient, deleteClient } = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(authorize('OWNER', 'ADMIN'), getClients)
  .post(authorize('OWNER', 'ADMIN'), createClient);

router.route('/:id')
  .get(getClient)
  .put(authorize('ADMIN'), updateClient)
  .delete(authorize('ADMIN'), deleteClient);

module.exports = router;
