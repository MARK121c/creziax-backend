const express = require('express');
const router = express.Router();
const { getTickets, getTicket, createTicket, updateTicket } = require('../controllers/ticketController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', getTickets);
router.get('/:id', getTicket);
router.post('/', authorize('CLIENT'), createTicket);
router.put('/:id', authorize('ADMIN', 'OWNER'), updateTicket);

module.exports = router;
