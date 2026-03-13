const express = require('express');
const router = express.Router();
const { getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice } = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getInvoices)
  .post(authorize('ADMIN'), createInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(authorize('ADMIN'), updateInvoice)
  .delete(authorize('ADMIN'), deleteInvoice);

module.exports = router;
