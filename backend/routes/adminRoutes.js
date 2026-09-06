const express = require('express');
const router = express.Router();
const {
  getUnverifiedProviders,
  updateProviderVerification,
  toggleUserSuspension
} = require('../controllers/adminController');

// NOTE: `protect` + `isAdmin` are applied at the server.js mount level.
// Every route in this file is therefore already admin-gated — no per-route
// middleware is needed here, which mirrors the pattern used in bookingRoutes.js.

// ── Feature 11: Provider Verification ──────────────────────────────────────
// GET  /api/admin/providers/unverified  — list providers awaiting verification
router.get('/providers/unverified', getUnverifiedProviders);

// PUT  /api/admin/providers/:id/verify  — approve or reject a provider
router.put('/providers/:id/verify', updateProviderVerification);

// ── Feature 14: System-Wide Access Control ─────────────────────────────────
// PUT  /api/admin/users/:id/suspend  — suspend or reactivate any user account
router.put('/users/:id/suspend', toggleUserSuspension);

module.exports = router;
