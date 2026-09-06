const pool = require('../config/db');

exports.getAvailability = async (req, res) => {
    try {
        const [availability] = await pool.query(
            `SELECT * FROM provider_availability WHERE provider_id = ? ORDER BY date ASC, start_time ASC`,
            [req.user.id]
        );
        res.json({ success: true, data: availability });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.addAvailabilityBlock = async (req, res) => {
    try {
        const { date, start_time, end_time } = req.body;
        
        const [result] = await pool.query(
            `INSERT INTO provider_availability (provider_id, date, start_time, end_time, is_blocked) VALUES (?, ?, ?, ?, TRUE)`,
            [req.user.id, date, start_time, end_time]
        );

        res.status(201).json({ success: true, message: 'Availability block added', data: { id: result.insertId } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.deleteAvailabilityBlock = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `DELETE FROM provider_availability WHERE id = ? AND provider_id = ?`,
            [id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Block not found or unauthorized' });
        }

        res.json({ success: true, message: 'Availability block removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
