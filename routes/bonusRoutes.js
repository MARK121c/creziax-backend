const express = require('express');
const router = express.Router();
const bonusController = require('../controllers/bonusController');
const { protect, admin } = require('../middleware/auth');

router.use(protect);

router.get('/', bonusController.getBonuses);
router.post('/', admin, bonusController.createBonus);
router.delete('/:id', admin, bonusController.deleteBonus);

module.exports = router;
