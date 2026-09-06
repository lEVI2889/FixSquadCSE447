const express = require('express');
const router = express.Router();
const { getCustomerBookings, getProviderBookings } = require('../controllers/bookingDashboardController');

// Mounted at the same /api/bookings prefix as Rohan's existing
// bookingRoutes.js, as a SECOND router — see Week2_Shan_CONTRACT.md,
// "Integration Notes", for the one-line addition to server.js this needs.
// Path-wise there's no collision: /customer/mine and /provider/mine don't
// overlap with /provider/pending or /:id/status.
router.get('/customer/mine', getCustomerBookings);
router.get('/provider/mine', getProviderBookings);

module.exports = router;
