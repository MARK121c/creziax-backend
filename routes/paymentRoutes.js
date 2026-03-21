const express = require('express');
const router = express.Router();
const { getPayments, createPayment, verifyPayment } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getPayments)
  .post(authorize('ADMIN', 'CLIENT'), createPayment);

router.route('/:id/verify')
  .put(authorize('OWNER', 'ADMIN'), verifyPayment);

module.exports = router;
