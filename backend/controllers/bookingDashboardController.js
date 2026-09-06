// ADDITIONS to Week2_Rohan_CONTRACT.md — not part of his shipped
// bookingController.js. Kept in a separate file/router on purpose so
// nothing here touches his existing controller or routes.
const pool = require('../config/db');

// GET /api/bookings/customer/mine
// Needed to power the Customer Booking Dashboard — the contract only
// specced a provider-side pending-requests fetch.
const getCustomerBookings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.customer_id, b.provider_id, b.service_id, b.status,
              b.scheduled_date, b.scheduled_time, b.total_price,
              p.name AS provider_name, s.name AS service_name,
              b.created_at, b.updated_at
       FROM bookings b
       JOIN users p ON p.id = b.provider_id
       JOIN services s ON s.id = b.service_id
       WHERE b.customer_id = ?
       ORDER BY b.scheduled_date DESC, b.scheduled_time DESC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('getCustomerBookings error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
};

// GET /api/bookings/provider/mine
// Needed for the Job Workflow board — the contract's provider/pending
// endpoint only returns new Pending requests, not a provider's
// already-Accepted or In-Progress jobs.
const getProviderBookings = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.customer_id, b.provider_id, b.service_id, b.status,
              b.scheduled_date, b.scheduled_time, b.total_price,
              u.name AS customer_name, s.name AS service_name,
              b.created_at, b.updated_at
       FROM bookings b
       JOIN users u ON u.id = b.customer_id
       JOIN services s ON s.id = b.service_id
       WHERE b.provider_id = ?
       ORDER BY FIELD(b.status, 'Pending','Accepted','In-Progress','Disputed','Completed','Rejected','Cancelled'),
                b.scheduled_date ASC, b.scheduled_time ASC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('getProviderBookings error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error fetching bookings' });
  }
};

module.exports = { getCustomerBookings, getProviderBookings };
