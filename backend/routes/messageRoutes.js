const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.get('/:bookingId', messageController.getMessages);
router.post('/:bookingId', messageController.sendMessage);

module.exports = router;
