const express = require('express');
const router = express.Router();
const bonusController = require('../controllers/bonusController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('OWNER', 'ADMIN'), bonusController.getBonuses);
router.post('/', protect, authorize('OWNER', 'ADMIN'), bonusController.createBonus);
router.delete('/:id', protect, authorize('OWNER'), bonusController.deleteBonus);

module.exports = router;
