/**
 * backend/controllers/security/keyController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Key Management Controller — Security Evolution Module
 *
 * Responsibilities:
 *   • Generate RSA or ECC key pairs for a user (using our custom engines)
 *   • Store the key pair in the `keys` table (private key AES-encrypted with
 *     a server-side wrapping key derived from JWT_SECRET + user_id)
 *   • Retrieve a user's active public key
 *   • Rotate keys (mark old key as 'rotated', insert fresh pair)
 *   • Revoke keys (mark status = 'revoked')
 *   • List all key records for a user (for audit / viva demo)
 *
 * Architectural rules:
 *   • Raw mysql2/promise SQL only — no ORM.
 *   • Cryptographic operations delegated entirely to backend/security/*.
 *   • Controller logic is kept in controllers/security/ (isolated from
 *     the baseline marketplace controllers in controllers/).
 *
 * Routes (to be wired into a securityRoutes.js):
 *   POST   /api/security/keys/generate    → generateKeyPair
 *   GET    /api/security/keys/active      → getActivePublicKey
 *   POST   /api/security/keys/rotate      → rotateKeyPair
 *   POST   /api/security/keys/revoke      → revokeKey
 *   GET    /api/security/keys             → listKeys
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const pool   = require('../../config/db');

// ── Custom crypto engines (no third-party libs) ───────────────────────────────
const rsa = require('../../security/rsa');
const ecc = require('../../security/ecc');

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive a 32-byte AES-256 wrapping key from the server's JWT_SECRET and the
 * user's numeric ID. This ties the encrypted private key to both the server
 * secret and the specific user, preventing cross-user decryption.
 *
 * Method: PBKDF2-SHA256, 10 000 iterations.
 * (We are allowed to use Node's built-in crypto for key-wrapping because the
 * constraint forbids third-party *libraries*, not the native crypto module.)
 *
 * @param {number|string} userId
 * @returns {Buffer} 32-byte wrapping key
 */
function deriveWrappingKey(userId) {
  const secret = process.env.JWT_SECRET || 'fixsquad-security-evolution';
  return crypto.pbkdf2Sync(
    secret,
    `fixsquad-key-wrap-${userId}`,
    10000,
    32,
    'sha256'
  );
}

/**
 * AES-256-GCM encrypt `plaintext` (string) with `key` (Buffer).
 * Returns hex-encoded payload: iv(24) + authTag(32) + ciphertext.
 * @param {string} plaintext
 * @param {Buffer} key 32-byte key
 * @returns {string} hex-encoded encrypted blob
 */
function aesEncrypt(plaintext, key) {
  const iv  = crypto.randomBytes(12);                   // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();                      // 16-byte auth tag
  return Buffer.concat([iv, tag, ct]).toString('hex');
}

/**
 * AES-256-GCM decrypt the blob produced by aesEncrypt.
 * @param {string} hexBlob  hex-encoded iv+tag+ciphertext
 * @param {Buffer} key      32-byte key
 * @returns {string}        decrypted plaintext
 */
function aesDecrypt(hexBlob, key) {
  const buf  = Buffer.from(hexBlob, 'hex');
  const iv   = buf.slice(0, 12);
  const tag  = buf.slice(12, 28);
  const ct   = buf.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct, undefined, 'utf8') + decipher.final('utf8');
}

/**
 * Serialise an RSA key pair to a JSON string suitable for storage / transport.
 * BigInt values are converted to decimal strings so they survive JSON round-trips.
 * @param {{ publicKey: {e, n}, privateKey: {d, n} }} keys
 * @returns {{ publicStr: string, privateStr: string }}
 */
function serialiseRsaKeyPair(keys) {
  const publicStr  = JSON.stringify({ e: keys.publicKey.e.toString(),
                                      n: keys.publicKey.n.toString() });
  const privateStr = JSON.stringify({ d: keys.privateKey.d.toString(),
                                      n: keys.privateKey.n.toString() });
  return { publicStr, privateStr };
}

/**
 * Serialise an ECC key pair.
 * Private key is a scalar BigInt; public key is a curve point {x, y}.
 * @param {BigInt} privKey
 * @param {{ x: BigInt, y: BigInt }} pubKey
 * @returns {{ publicStr: string, privateStr: string }}
 */
function serialiseEccKeyPair(privKey, pubKey) {
  const publicStr  = JSON.stringify({ x: pubKey.x.toString(),
                                      y: pubKey.y.toString() });
  const privateStr = JSON.stringify({ k: privKey.toString() });
  return { publicStr, privateStr };
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/security/keys/generate
 * Body: { key_type: 'RSA' | 'ECC' }   (defaults to 'RSA')
 *
 * Generates a fresh key pair for the authenticated user, encrypts the private
 * key with the per-user wrapping key, and persists both into `keys`.
 * Any previously active key for this user+type is rotated automatically.
 */
const generateKeyPair = async (req, res) => {
  const userId  = req.user.id;
  const keyType = (req.body.key_type || 'RSA').toUpperCase();

  if (!['RSA', 'ECC'].includes(keyType)) {
    return res.status(400).json({
      success: false,
      message: "key_type must be 'RSA' or 'ECC'.",
    });
  }

  try {
    // ── 1. Generate the raw key pair using our custom engine ────────────────
    let publicStr, privateStr;

    if (keyType === 'RSA') {
      const keys = rsa.generateKeyPair();               // 256-bit modulus
      ({ publicStr, privateStr } = serialiseRsaKeyPair(keys));
    } else {
      const privKey = ecc.generatePrivateKey();
      const pubKey  = ecc.derivePublicKey(privKey);
      ({ publicStr, privateStr } = serialiseEccKeyPair(privKey, pubKey));
    }

    // ── 2. Encrypt the private key with the per-user wrapping key ───────────
    const wrapKey            = deriveWrappingKey(userId);
    const privateKeyEncrypted = aesEncrypt(privateStr, wrapKey);

    // ── 3. Rotate any existing active key for this user+type ────────────────
    await pool.query(
      `UPDATE \`keys\`
          SET status = 'rotated'
        WHERE user_id = ? AND key_type = ? AND status = 'active'`,
      [userId, keyType]
    );

    // ── 4. Insert the new key pair ───────────────────────────────────────────
    const [result] = await pool.query(
      `INSERT INTO \`keys\` (user_id, public_key, private_key_encrypted, key_type, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [userId, publicStr, privateKeyEncrypted, keyType]
    );

    return res.status(201).json({
      success: true,
      message: `${keyType} key pair generated and stored successfully.`,
      data: {
        id:         result.insertId,
        user_id:    userId,
        key_type:   keyType,
        public_key: publicStr,         // caller may store locally for encryption use
        status:     'active',
      },
    });
  } catch (err) {
    console.error('[keyController] generateKeyPair error:', err);
    return res.status(500).json({ success: false, message: 'Key generation failed.' });
  }
};

/**
 * GET /api/security/keys/active
 * Query: ?key_type=RSA  (optional, defaults to RSA)
 *
 * Returns the active public key for the authenticated user.
 * The private key is never returned by any endpoint.
 */
const getActivePublicKey = async (req, res) => {
  const userId  = req.user.id;
  const keyType = (req.query.key_type || 'RSA').toUpperCase();

  try {
    const [rows] = await pool.query(
      `SELECT id, public_key, key_type, status, created_at
         FROM \`keys\`
        WHERE user_id = ? AND key_type = ? AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId, keyType]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No active ${keyType} key found for this user. Call /generate first.`,
      });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[keyController] getActivePublicKey error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve public key.' });
  }
};

/**
 * POST /api/security/keys/rotate
 * Body: { key_type: 'RSA' | 'ECC' }
 *
 * Explicit rotation endpoint — generates a new pair, marks the old one
 * as 'rotated'. This is a thin alias over generateKeyPair with a clearer
 * semantic intent (rotation vs. first-time generation).
 */
const rotateKeyPair = async (req, res) => {
  // Rotation is functionally identical to generation (the generate action
  // already rotates the previous key). We delegate directly.
  return generateKeyPair(req, res);
};

/**
 * POST /api/security/keys/revoke
 * Body: { key_id: <number> }   — ID of the key record to revoke.
 *
 * Marks a specific key as 'revoked'. Only the owning user can revoke their
 * own keys (user_id check prevents horizontal privilege escalation).
 */
const revokeKey = async (req, res) => {
  const userId = req.user.id;
  const keyId  = parseInt(req.body.key_id, 10);

  if (!keyId || isNaN(keyId)) {
    return res.status(400).json({ success: false, message: 'key_id (integer) is required.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE \`keys\`
          SET status = 'revoked'
        WHERE id = ? AND user_id = ? AND status = 'active'`,
      [keyId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Key not found, already revoked/rotated, or does not belong to you.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Key ${keyId} has been revoked.`,
    });
  } catch (err) {
    console.error('[keyController] revokeKey error:', err);
    return res.status(500).json({ success: false, message: 'Failed to revoke key.' });
  }
};

/**
 * GET /api/security/keys
 * Query: ?status=active|revoked|rotated  (optional, returns all if omitted)
 *
 * Audit endpoint — lists all key records for the authenticated user.
 * Private key ciphertext is excluded from the response.
 */
const listKeys = async (req, res) => {
  const userId = req.user.id;
  const status = req.query.status;          // optional filter

  const validStatuses = ['active', 'revoked', 'rotated'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${validStatuses.join(', ')}.`,
    });
  }

  try {
    let sql    = `SELECT id, user_id, public_key, key_type, status, created_at
                    FROM \`keys\`
                   WHERE user_id = ?`;
    const params = [userId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);

    return res.status(200).json({
      success: true,
      count:   rows.length,
      data:    rows,
    });
  } catch (err) {
    console.error('[keyController] listKeys error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list keys.' });
  }
};

/**
 * Internal helper (not an HTTP handler) — decrypt and return a user's
 * private key object for use by other security controllers (e.g. signing).
 * Call this server-side only; NEVER expose via an HTTP route.
 *
 * @param {number} userId
 * @param {'RSA'|'ECC'} keyType
 * @returns {Promise<object|null>}  parsed private key object, or null if none active
 */
const loadPrivateKey = async (userId, keyType = 'RSA') => {
  const [rows] = await pool.query(
    `SELECT private_key_encrypted, key_type
       FROM \`keys\`
      WHERE user_id = ? AND key_type = ? AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, keyType]
  );

  if (rows.length === 0) return null;

  const wrapKey   = deriveWrappingKey(userId);
  const plaintext = aesDecrypt(rows[0].private_key_encrypted, wrapKey);
  const parsed    = JSON.parse(plaintext);

  if (keyType === 'RSA') {
    return { d: BigInt(parsed.d), n: BigInt(parsed.n) };
  } else {
    return { k: BigInt(parsed.k) };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  generateKeyPair,
  getActivePublicKey,
  rotateKeyPair,
  revokeKey,
  listKeys,
  loadPrivateKey,    // exported for internal server-side use only
};
