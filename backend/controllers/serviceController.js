/**
 * backend/controllers/serviceController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Service Management Controller — Security Evolution Module
 *
 * Changes from baseline:
 *   • Sensitive field (description) is RSA-encrypted at rest using the
 *     provider's active RSA public key (fetched from the `keys` table).
 *   • On reads, the provider's RSA private key is loaded from the KMM
 *     (unwrapped via AES-256-GCM) and used to decrypt description before
 *     returning the response — the React frontend receives plaintext JSON.
 *   • Keyword search now correctly searches against DECRYPTED descriptions
 *     in memory after fetching (SQL LIKE cannot search encrypted blobs).
 *   • Decryption failures are isolated per-record; a single corrupt entry
 *     falls back to '[encrypted]' rather than crashing the endpoint.
 *
 * Preserved baseline contracts:
 *   • All HTTP routes, request/response shapes, and SQL table/column names
 *     remain unchanged — no frontend edits required.
 *   • Raw mysql2/promise SQL only — no ORM.
 *   • req.user.id is the authenticated user (set by authMiddleware.protect).
 *
 * Encrypted field: `description` (TEXT column in `services` table).
 * Non-encrypted fields: name, base_price, category_id — not sensitive.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const pool = require('../config/db');

// ── Security Evolution: RSA text codec + KMM private key loader ───────────────
const { rsaEncryptText, safeRsaDecryptText, isRsaEncrypted } = require('../security/rsaTextCodec');
const { loadPrivateKey } = require('./security/keyController');

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the provider's active RSA public key from the `keys` table.
 * Returns the parsed { e, n } object (BigInt fields), or null if not found.
 *
 * @param {number} providerId
 * @returns {Promise<{ e: BigInt, n: BigInt } | null>}
 */
async function fetchPublicKey(providerId) {
  const [rows] = await pool.query(
    `SELECT public_key
       FROM \`keys\`
      WHERE user_id = ? AND key_type = 'RSA' AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1`,
    [providerId]
  );
  if (rows.length === 0) return null;

  try {
    const parsed = JSON.parse(rows[0].public_key);
    return { e: BigInt(parsed.e), n: BigInt(parsed.n) };
  } catch {
    return null;
  }
}

/**
 * Encrypt the description for a service record.
 * If no active RSA key is found for the provider, store plaintext with a
 * warning log — the field will be decrypted transparently on read via the
 * legacy pass-through in rsaTextCodec.
 *
 * @param {string|null} description
 * @param {number} providerId
 * @returns {Promise<string>}
 */
async function encryptDescription(description, providerId) {
  if (!description) return description;

  const pubKey = await fetchPublicKey(providerId);
  if (!pubKey) {
    console.warn(`[serviceController] No active RSA public key for provider ${providerId}. Storing description as plaintext.`);
    return description;
  }

  try {
    return rsaEncryptText(description, pubKey);
  } catch (err) {
    console.error(`[serviceController] Encryption failed for provider ${providerId}:`, err.message);
    return description;   // graceful fallback: store plaintext
  }
}

/**
 * Decrypt the description field of a service row in place.
 * Mutates the passed object and returns it for chaining.
 * On any failure, sets description to '[encrypted]'.
 *
 * @param {object} service  raw DB row
 * @param {object|null} privateKey  RSA private key { d, n } (BigInt)
 * @returns {object}  same service object with decrypted description
 */
function decryptServiceRow(service, privateKey) {
  if (service.description && isRsaEncrypted(service.description)) {
    service.description = safeRsaDecryptText(service.description, privateKey);
  }
  return service;
}

/**
 * Load all private keys needed to decrypt a list of service rows.
 * Groups rows by provider_id so we issue at most one DB query per provider.
 *
 * @param {object[]} services  raw DB rows (must have `provider_id`)
 * @returns {Promise<Map<number, object|null>>}  Map of provider_id → private key
 */
async function loadPrivateKeyMap(services) {
  const providerIds = [...new Set(services.map(s => s.provider_id))];
  const keyMap      = new Map();

  await Promise.all(
    providerIds.map(async (pid) => {
      try {
        const privKey = await loadPrivateKey(pid, 'RSA');
        keyMap.set(pid, privKey);
      } catch (err) {
        console.warn(`[serviceController] Could not load private key for provider ${pid}:`, err.message);
        keyMap.set(pid, null);
      }
    })
  );
  return keyMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/services/provider  (or wherever serviceRoutes wires this)
 * Fetch all services for the authenticated provider, decrypting descriptions.
 */
const getProviderServices = async (req, res) => {
  try {
    const providerId = req.user.id;

    const query = `
      SELECT s.*, c.name AS category_name
        FROM services s
        LEFT JOIN categories c ON s.category_id = c.id
       WHERE s.provider_id = ?
       ORDER BY s.created_at DESC
    `;
    const [services] = await pool.query(query, [providerId]);

    // Decrypt descriptions — all rows share the same provider
    const privKey = await loadPrivateKey(providerId, 'RSA').catch(() => null);
    const decrypted = services.map(s => decryptServiceRow({ ...s }, privKey));

    res.status(200).json({ success: true, data: decrypted });
  } catch (error) {
    console.error('[serviceController] getProviderServices error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * POST /api/services
 * Create a new service — encrypts description before INSERT.
 */
const createService = async (req, res) => {
  try {
    const providerId = req.user.id;
    const { category_id, name, description, base_price } = req.body;

    if (!category_id || !name || base_price === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // ── Encrypt the sensitive description field ────────────────────────────
    const encryptedDesc = await encryptDescription(description, providerId);

    const query = `
      INSERT INTO services (provider_id, category_id, name, description, base_price)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(query, [providerId, category_id, name, encryptedDesc, base_price]);

    // Return plaintext description to the client — the frontend never sees ciphertext
    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: {
        id:          result.insertId,
        provider_id: providerId,
        category_id,
        name,
        description,    // plaintext — not the stored ciphertext
        base_price,
      },
    });
  } catch (error) {
    console.error('[serviceController] createService error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PUT /api/services/:id
 * Update an existing service — re-encrypts description before UPDATE.
 */
const updateService = async (req, res) => {
  try {
    const providerId = req.user.id;
    const serviceId  = req.params.id;
    const { category_id, name, description, base_price } = req.body;

    if (!category_id || !name || base_price === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // ── Encrypt the updated description ───────────────────────────────────
    const encryptedDesc = await encryptDescription(description, providerId);

    const query = `
      UPDATE services
         SET category_id = ?, name = ?, description = ?, base_price = ?
       WHERE id = ? AND provider_id = ?
    `;
    const [result] = await pool.query(
      query,
      [category_id, name, encryptedDesc, base_price, serviceId, providerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Service not found or unauthorized' });
    }

    res.status(200).json({ success: true, message: 'Service updated successfully' });
  } catch (error) {
    console.error('[serviceController] updateService error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * DELETE /api/services/:id  — unchanged from baseline (no encryption concern)
 */
const deleteService = async (req, res) => {
  try {
    const providerId = req.user.id;
    const serviceId  = req.params.id;

    const query = `DELETE FROM services WHERE id = ? AND provider_id = ?`;
    const [result] = await pool.query(query, [serviceId, providerId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Service not found or unauthorized' });
    }

    res.status(200).json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    console.error('[serviceController] deleteService error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * GET /api/services/search  (query params: keyword, category_id, min_price, max_price, sort)
 *
 * Note on keyword search: SQL LIKE cannot search inside RSA ciphertext.
 * All keyword filtering is performed IN-MEMORY after decryption.
 * The SQL query still handles category_id and price-range filters (numeric,
 * not encrypted), so the DB scan is still efficient for those dimensions.
 */
const searchServices = async (req, res) => {
  try {
    const { keyword, category_id, min_price, max_price, sort } = req.query;

    let sql = `
      SELECT
        s.id, s.provider_id, s.category_id, s.name,
        s.description, s.base_price, s.created_at,
        c.name AS category_name, c.icon AS category_icon,
        u.name AS provider_name,
        4.8 AS provider_rating, 12 AS total_reviews
      FROM services s
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN users u ON s.provider_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Numeric / categorical filters handled by SQL (not encrypted)
    if (category_id && category_id !== 'all' && !isNaN(category_id)) {
      sql += ' AND s.category_id = ?';
      params.push(Number(category_id));
    }
    if (min_price && !isNaN(min_price)) {
      sql += ' AND s.base_price >= ?';
      params.push(Number(min_price));
    }
    if (max_price && !isNaN(max_price)) {
      sql += ' AND s.base_price <= ?';
      params.push(Number(max_price));
    }

    // Sorting
    if (sort === 'price_asc')   sql += ' ORDER BY s.base_price ASC';
    else if (sort === 'price_desc') sql += ' ORDER BY s.base_price DESC';
    else                         sql += ' ORDER BY s.created_at DESC';

    const [services] = await pool.query(sql, params);

    // ── Decrypt descriptions (one private-key load per unique provider) ─────
    const keyMap    = await loadPrivateKeyMap(services);
    let decrypted   = services.map(s =>
      decryptServiceRow({ ...s }, keyMap.get(s.provider_id) || null)
    );

    // ── Keyword filter — now works on decrypted text ───────────────────────
    if (keyword && keyword.trim()) {
      const term = keyword.trim().toLowerCase();
      decrypted = decrypted.filter(s =>
        (s.name         && s.name.toLowerCase().includes(term)) ||
        (s.description  && s.description.toLowerCase().includes(term)) ||
        (s.category_name && s.category_name.toLowerCase().includes(term))
      );
    }

    // In-memory sort for rating (not in SQL — rating is a stub constant)
    if (sort === 'rating_desc') {
      decrypted.sort((a, b) => Number(b.provider_rating || 0) - Number(a.provider_rating || 0));
    }

    return res.status(200).json({
      success: true,
      count:   decrypted.length,
      data:    decrypted,
    });
  } catch (error) {
    console.error('[serviceController] searchServices error:', error);
    return res.status(500).json({ success: false, message: 'Server Error during service search' });
  }
};

/**
 * GET /api/services/:id  — Fetch a single service by ID, decrypt description.
 */
const getServiceById = async (req, res) => {
  try {
    const serviceId = Number(req.params.id);
    const sql = `
      SELECT
        s.id, s.provider_id, s.category_id, s.name,
        s.description, s.base_price, s.created_at,
        c.name AS category_name, c.icon AS category_icon,
        u.name AS provider_name,
        4.8 AS provider_rating, 12 AS total_reviews
      FROM services s
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN users u ON s.provider_id = u.id
      WHERE s.id = ?
    `;
    const [services] = await pool.query(sql, [serviceId]);

    if (!services || services.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const service = { ...services[0] };

    // ── Decrypt description using the provider's private key ───────────────
    const privKey = await loadPrivateKey(service.provider_id, 'RSA').catch(() => null);
    decryptServiceRow(service, privKey);

    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    console.error('[serviceController] getServiceById error:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getProviderServices,
  createService,
  updateService,
  deleteService,
  searchServices,
  getServiceById,
};
