const express = require('express');
const router = express.Router();
const { getPayments, createPayment, deletePayment } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getPayments)
  .post(authorize('ADMIN'), createPayment);

router.route('/:id')
  .delete(authorize('ADMIN'), deletePayment);

module.exports = router;
