const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('OWNER', 'ADMIN'), expenseController.getExpenses);
router.post('/', protect, authorize('OWNER', 'ADMIN'), expenseController.createExpense);
router.get('/:id/download', protect, authorize('OWNER', 'ADMIN'), expenseController.downloadExpensePDF);
router.put('/:id', protect, authorize('OWNER', 'ADMIN'), expenseController.updateExpense);
router.delete('/:id', protect, authorize('OWNER'), expenseController.deleteExpense);

module.exports = router;
