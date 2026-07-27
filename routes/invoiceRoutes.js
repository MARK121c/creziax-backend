const express = require('express');
const router = express.Router();
const { getInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, downloadInvoicePDF } = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getInvoices)
  .post(authorize('ADMIN'), createInvoice);

router.route('/:id')
  .get(getInvoice)
  .put(authorize('ADMIN'), updateInvoice)
  .delete(authorize('ADMIN'), deleteInvoice);

router.get('/:id/download', downloadInvoicePDF);

module.exports = router;
