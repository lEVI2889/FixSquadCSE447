/**
 * backend/middleware/authMiddleware.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Authentication Middleware — Security Evolution Module
 *
 * Preserved contracts (must not break existing routes):
 *   CONTRACT (Rohan's Week1_Rohan_CONTRACT.md §2):
 *     req.user.id  — authenticated user's numeric ID, attached by `protect`
 *   CONTRACT (Naim's Week2_Naim_CONTRACT.md):
 *     req.user.role — attached by `protect`; consumed by `isAdmin`
 *
 * Security Evolution additions:
 *   • `protect` now rejects tokens whose token_type is '2fa_pending'.
 *     A 2FA-pending token must ONLY be usable at POST /api/auth/verify-2fa
 *     and must never grant access to marketplace routes.
 *   • Token type is extracted from the decoded payload and recorded on
 *     req.tokenType for upstream debugging / audit logging.
 *   • `protect2faPending` — a separate lightweight middleware used
 *     exclusively by the verify-2fa route to accept only pending tokens.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────────────────────────────────────
// protect
// Used by all existing marketplace routes (services, bookings, messages, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a Bearer JWT in the Authorization header.
 *
 * Rejects:
 *   • Missing / malformed tokens
 *   • Expired tokens
 *   • Tokens whose token_type === '2fa_pending'  ← Security Evolution addition
 *
 * On success, attaches:
 *   req.user      = { id, role }
 *   req.tokenType = 'session'  (or whatever token_type is in the payload)
 */
const protect = (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── Security Evolution: block 2FA-pending tokens from marketplace routes ─
    // A 2fa_pending token carries no `role` and must only be accepted at
    // the verify-2fa endpoint. Using it here is either a client bug or an
    // attack attempt — reject explicitly rather than allowing a role-less user.
    if (decoded.token_type === '2fa_pending') {
      return res.status(401).json({
        success: false,
        message: '2FA verification is required. Complete 2FA at POST /api/auth/verify-2fa.',
      });
    }

    // Attach user context — same shape as the baseline so all existing
    // route handlers continue to work without modification.
    req.user      = { id: decoded.id, role: decoded.role };
    req.tokenType = decoded.token_type || 'session';

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token invalid or expired',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// protect2faPending
// Used ONLY by POST /api/auth/verify-2fa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight middleware that accepts ONLY '2fa_pending' tokens.
 * Rejects full session tokens so this endpoint can't be abused as a
 * second login path.
 *
 * Attaches req.pendingUserId for use by the verify2fa handler.
 * (verify2fa already re-fetches the full user row, so no role is needed here.)
 */
const protect2faPending = (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Also accept token from the request body (flexibility for mobile clients)
  if (!token && req.body && req.body.temp_token) {
    token = req.body.temp_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'A 2FA pending token is required.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.token_type !== '2fa_pending') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token type. This endpoint requires a 2FA pending token.',
      });
    }

    req.pendingUserId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: '2FA session expired or token invalid. Please log in again.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// isAdmin
// Unchanged from baseline — must come after `protect` in the chain.
// Usage: app.use('/api/admin', protect, isAdmin, adminRoutes)
// ─────────────────────────────────────────────────────────────────────────────

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Forbidden: Admin access required.',
  });
};

module.exports = { protect, protect2faPending, isAdmin };
