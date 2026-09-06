const pool = require('../config/db');

// ─────────────────────────────────────────────
// FEATURE 11: Provider Verification System
// ─────────────────────────────────────────────

// GET /api/admin/providers/unverified
// Returns all provider accounts whose verification_status is 'Pending'.
// Passwords are explicitly excluded from the SELECT list.
exports.getUnverifiedProviders = async (req, res) => {
  try {
    const sql = `
      SELECT id, name, email, role, verification_status, is_suspended, created_at
      FROM users
      WHERE role = 'provider'
        AND verification_status = 'Pending'
      ORDER BY created_at ASC
    `;
    const [providers] = await pool.query(sql);

    return res.status(200).json({
      success: true,
      count: providers.length,
      data: providers
    });
  } catch (err) {
    console.error('getUnverifiedProviders error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error while fetching unverified providers.' });
  }
};

// PUT /api/admin/providers/:id/verify
// Updates the verification_status of a specific provider.
// Allowed values: 'Approved' | 'Rejected'
exports.updateProviderVerification = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const ALLOWED_STATUSES = ['Approved', 'Rejected'];
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}.`
    });
  }

  try {
    // Confirm the target user exists and is a provider
    const [rows] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND role = 'provider'`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Provider with ID ${id} not found.`
      });
    }

    await pool.query(
      `UPDATE users SET verification_status = ? WHERE id = ?`,
      [status, id]
    );

    return res.status(200).json({
      success: true,
      message: `Provider verification status updated to ${status}.`
    });
  } catch (err) {
    console.error('updateProviderVerification error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error while updating verification status.' });
  }
};

// ─────────────────────────────────────────────
// FEATURE 14: System-Wide Access Control
// ─────────────────────────────────────────────

// PUT /api/admin/users/:id/suspend
// Suspends (is_suspended = 1) or reactivates (is_suspended = 0) any user account.
// An admin cannot suspend their own account (self-suspension guard).
exports.toggleUserSuspension = async (req, res) => {
  const { id } = req.params;
  const { is_suspended } = req.body;

  // Guard: prevent admin from suspending themselves
  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'An admin cannot suspend their own account.'
    });
  }

  // Validate the flag value — must be exactly 0 or 1
  if (is_suspended !== 0 && is_suspended !== 1) {
    return res.status(400).json({
      success: false,
      message: 'Invalid value for is_suspended. Must be 0 (reactivate) or 1 (suspend).'
    });
  }

  try {
    // Confirm the target user exists
    const [rows] = await pool.query(
      `SELECT id, name FROM users WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${id} not found.`
      });
    }

    await pool.query(
      `UPDATE users SET is_suspended = ? WHERE id = ?`,
      [is_suspended, id]
    );

    const action = is_suspended === 1 ? 'suspended' : 'reactivated';
    return res.status(200).json({
      success: true,
      message: `User account has been ${action}.`
    });
  } catch (err) {
    console.error('toggleUserSuspension error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error while updating suspension status.' });
  }
};
