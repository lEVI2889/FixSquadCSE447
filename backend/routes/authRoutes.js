/**
 * backend/routes/authRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth Routes — Security Evolution Module
 *
 * Baseline routes preserved (same paths, no breaking changes):
 *   POST /api/auth/register
 *   POST /api/auth/login
 *
 * Security Evolution additions:
 *   POST /api/auth/verify-2fa   — exchange temp_token + code for session JWT
 *   POST /api/auth/setup-2fa    — enable 2FA (protected: session JWT required)
 *   POST /api/auth/disable-2fa  — disable 2FA (protected: session JWT required)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const router  = express.Router();

const {
  register,
  login,
  verify2fa,
  setup2fa,
  disable2fa,
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// ── Public routes (no auth required) ─────────────────────────────────────────
router.post('/register',   register);
router.post('/login',      login);

// verify-2fa: accepts a 2fa_pending token (validated inside the handler itself
// via jwt.verify + token_type check — no middleware needed here to keep the
// route callable without any prior Bearer token in the header).
router.post('/verify-2fa', verify2fa);

// ── Protected routes (valid session JWT required) ─────────────────────────────
router.post('/setup-2fa',   protect, setup2fa);
router.post('/disable-2fa', protect, disable2fa);

module.exports = router;
