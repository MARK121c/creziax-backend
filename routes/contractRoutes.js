const express = require('express');
const router = express.Router();
const { getContracts, getContract, createContract, updateContract, deleteContract } = require('../controllers/contractController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getContracts);
router.get('/:id', protect, authorize('OWNER', 'ADMIN'), getContract);
router.post('/', protect, authorize('OWNER', 'ADMIN'), createContract);
router.put('/:id', protect, authorize('OWNER', 'ADMIN'), updateContract);
router.delete('/:id', protect, authorize('OWNER', 'ADMIN'), deleteContract);

module.exports = router;
