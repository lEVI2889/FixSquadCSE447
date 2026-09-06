const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const bookingController2 = require('../controllers/bookingController');
const { getProviderBookings, updateBookingStatus } = require('../controllers/bookingController');

router.get('/provider/pending', getProviderBookings);
router.put('/:id/status', updateBookingStatus);

router.get('/check-availability', bookingController2.checkAvailability);
router.post('/', protect, bookingController2.createBooking);

module.exports = router;
