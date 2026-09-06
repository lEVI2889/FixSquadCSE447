const pool = require('../config/db');
const { isKnownStatus, isValidTransition, messageFor } = require('../utils/bookingStatusTransitions');

const DEFAULT_SLOTS = [
  '09:00:00',
  '10:00:00',
  '11:00:00',
  '12:00:00',
  '14:00:00',
  '15:00:00',
  '16:00:00',
  '17:00:00',
  '18:00:00'
];

/**
 * Format 24h time to 12h readable string
 */
function formatTimeLabel(timeStr) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}


exports.getProviderBookings = async (req, res) => {
    try {
        const [bookings] = await pool.query(
            `SELECT b.*, u.name as customer_name, s.name as service_name 
             FROM bookings b
             JOIN users u ON b.customer_id = u.id
             JOIN services s ON b.service_id = s.id
             WHERE b.provider_id = ? AND b.status = 'Pending'
             ORDER BY b.scheduled_date ASC, b.scheduled_time ASC`,
            [req.user.id]
        );
        res.json({ success: true, data: bookings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!isKnownStatus(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Fetch current booking to validate transition
        const [bookings] = await pool.query(
            `SELECT status FROM bookings WHERE id = ? AND provider_id = ?`,
            [id, req.user.id]
        );

        if (bookings.length === 0) {
            return res.status(404).json({ success: false, message: 'Booking not found or unauthorized' });
        }

        const currentStatus = bookings[0].status;

        if (!isValidTransition(currentStatus, status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot move booking from '${currentStatus}' to '${status}'`
            });
        }

        await pool.query(
            `UPDATE bookings SET status = ? WHERE id = ?`,
            [status, id]
        );

        res.json({ success: true, message: messageFor(status) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};



exports.checkAvailability = async (req, res) => {
  try {
    const { provider_id, date } = req.query;

    if (!provider_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'provider_id and date (YYYY-MM-DD) query parameters are required'
      });
    }

    const pId = Number(provider_id);
    const dateStr = String(date).split('T')[0];

    // 1. Fetch blocked ranges from provider_availability
    const availSql = `
      SELECT start_time, end_time, is_blocked 
      FROM provider_availability 
      WHERE provider_id = ? AND date = ? AND is_blocked = 1
    `;
    const [blockedRecords] = await pool.query(availSql, [pId, dateStr]);

    // 2. Fetch existing active bookings on that date
    const bookingsSql = `
      SELECT scheduled_time 
      FROM bookings 
      WHERE provider_id = ? AND scheduled_date = ? AND status NOT IN ('Rejected', 'Cancelled')
    `;
    const [existingBookings] = await pool.query(bookingsSql, [pId, dateStr]);

    const bookedTimes = existingBookings.map(b => String(b.scheduled_time).substring(0, 8));

    // 3. Map slot availability
    const slots = DEFAULT_SLOTS.map((time) => {
      let isAvailable = true;
      let reason = 'Available';

      // Check if slot falls into any blocked time window
      for (const block of blockedRecords) {
        const start = block.start_time ? String(block.start_time).substring(0, 8) : '00:00:00';
        const end = block.end_time ? String(block.end_time).substring(0, 8) : '23:59:59';
        if (time >= start && time < end) {
          isAvailable = false;
          reason = 'Provider Unavailable / Blocked';
          break;
        }
      }

      // Check if slot is already booked by another customer
      if (isAvailable && bookedTimes.includes(time)) {
        isAvailable = false;
        reason = 'Already Booked';
      }

      return {
        time,
        label: formatTimeLabel(time),
        available: isAvailable,
        reason
      };
    });

    return res.status(200).json({
      success: true,
      provider_id: pId,
      date: dateStr,
      slots
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return res.status(500).json({ success: false, message: 'Server error checking availability' });
  }
};
exports.createBooking = async (req, res) => {
  try {
    const customer_id = req.user.id;
    const { service_id, provider_id, scheduled_date, scheduled_time, notes } = req.body;

    if (!service_id || !scheduled_date || !scheduled_time) {
      return res.status(400).json({
        success: false,
        message: 'service_id, scheduled_date and scheduled_time are required'
      });
    }

    // 1. Fetch service to verify existence, provider_id, and base_price
    const [services] = await pool.query('SELECT * FROM services WHERE id = ?', [Number(service_id)]);
    if (!services || services.length === 0) {
      return res.status(404).json({ success: false, message: 'Selected service does not exist' });
    }

    const service = services[0];
    const targetProviderId = Number(provider_id || service.provider_id);
    const dateStr = String(scheduled_date).split('T')[0];
    const timeStr = String(scheduled_time).length === 5 ? `${scheduled_time}:00` : scheduled_time;
    const totalPrice = Number(service.base_price);

    // 2. Conflict Check: verify provider availability blocks
    const [blocked] = await pool.query(`
      SELECT * FROM provider_availability 
      WHERE provider_id = ? AND date = ? AND is_blocked = 1
    `, [targetProviderId, dateStr]);

    for (const b of blocked) {
      const start = b.start_time ? String(b.start_time).substring(0, 8) : '00:00:00';
      const end = b.end_time ? String(b.end_time).substring(0, 8) : '23:59:59';
      if (timeStr >= start && timeStr < end) {
        return res.status(409).json({
          success: false,
          message: 'The selected provider is unavailable during this time slot. Please choose another time.'
        });
      }
    }

    // 3. Conflict Check: verify existing booking
    const [existing] = await pool.query(`
      SELECT * FROM bookings 
      WHERE provider_id = ? AND scheduled_date = ? AND scheduled_time = ? AND status NOT IN ('Rejected', 'Cancelled')
    `, [targetProviderId, dateStr, timeStr]);

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please choose an alternative slot.'
      });
    }

    // 4. Insert into bookings table with status 'Pending' (adhering strictly to Week2_Rohan_CONTRACT.md)
    const insertSql = `
      INSERT INTO bookings (customer_id, provider_id, service_id, status, scheduled_date, scheduled_time, total_price)
      VALUES (?, ?, ?, 'Pending', ?, ?, ?)
    `;

    const [result] = await pool.query(insertSql, [
      customer_id,
      targetProviderId,
      Number(service_id),
      dateStr,
      timeStr,
      totalPrice,
    ]);

    const newBookingId = result.insertId;

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully! Your request is pending provider confirmation.',
      data: {
        id: newBookingId,
        customer_id,
        provider_id: targetProviderId,
        service_id: Number(service_id),
        service_name: service.name,
        status: 'Pending',
        scheduled_date: dateStr,
        scheduled_time: timeStr,
        total_price: totalPrice,
      }
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating booking' });
  }
};