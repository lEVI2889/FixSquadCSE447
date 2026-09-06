const express = require('express');
const router = express.Router();
const { getAvailability, addAvailabilityBlock, deleteAvailabilityBlock } = require('../controllers/availabilityController');

router.get('/', getAvailability);
router.post('/', addAvailabilityBlock);
router.delete('/:id', deleteAvailabilityBlock);

module.exports = router;
