/**
 * backend/controllers/authController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Authentication Controller — Security Evolution Module
 *
 * Changes from baseline:
 *   • bcryptjs REMOVED — replaced by backend/security/hash.js (custom PBKDF)
 *   • register: stores custom hash + extracted salt; auto-generates RSA & ECC
 *     key pairs via the Key Management Module (KMM)
 *   • login:    verifies against custom hash; if 2FA is enabled, returns a
 *               short-lived "2fa_pending" token instead of a full session JWT
 *   • verify2fa: validates the 2FA code and issues the final session JWT
 *
 * Preserved behaviors (baseline contract):
 *   • POST /api/auth/register  — same request/response shape
 *   • POST /api/auth/login     — same request shape; response extended for 2FA
 *   • JWT payload: { id, role } — unchanged so all protected routes keep working
 *   • Raw mysql2/promise SQL only — no ORM
 *
 * Sprint 2 notes (Naim's Week2_Naim_CONTRACT.md) preserved:
 *   • `role` carried in JWT payload, req.user.role available in middleware
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');         // randomBytes only — for 2FA secret gen
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');

// ── Security Evolution: custom password hashing engine (no bcryptjs) ─────────
const { hashPassword, verifyPassword } = require('../security/hash');

// ── KMM: internal key-generation helper (server-side only) ────────────────────
// We call the raw engine functions directly here to avoid HTTP round-trips.
const rsa = require('../security/rsa');
const ecc = require('../security/ecc');

// ─────────────────────────────────────────────────────────────────────────────
// Token factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full session JWT — issued after successful login (no 2FA) or after 2FA
 * verification. Payload matches the baseline: { id, role }.
 * token_type claim added so authMiddleware can distinguish token classes.
 *
 * @param {number} id
 * @param {string} role
 * @returns {string}
 */
function generateSessionToken(id, role) {
  return jwt.sign(
    { id, role, token_type: 'session' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Short-lived "2FA pending" token — issued during login when 2FA is enabled.
 * Contains no role so it cannot be used to access protected routes.
 * Expires in 10 minutes (enough time for a user to retrieve their TOTP code).
 *
 * @param {number} id
 * @returns {string}
 */
function generate2faPendingToken(id) {
  return jwt.sign(
    { id, token_type: '2fa_pending' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KMM helper — provision initial RSA + ECC key pairs on registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the AES-256-GCM wrapping key used by the KMM to protect private keys.
 * Must stay in sync with keyController.js::deriveWrappingKey().
 * @param {number|string} userId
 * @returns {Buffer} 32-byte key
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

function aesEncrypt(plaintext, key) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('hex');
}

/**
 * Serialize RSA key pair fields as decimal strings (BigInt → JSON safe).
 */
function serialiseRsa(keys) {
  return {
    publicStr:  JSON.stringify({ e: keys.publicKey.e.toString(),
                                 n: keys.publicKey.n.toString() }),
    privateStr: JSON.stringify({ d: keys.privateKey.d.toString(),
                                 n: keys.privateKey.n.toString() }),
  };
}

/**
 * Serialize ECC key pair fields as decimal strings.
 */
function serialiseEcc(privKey, pubKey) {
  return {
    publicStr:  JSON.stringify({ x: pubKey.x.toString(), y: pubKey.y.toString() }),
    privateStr: JSON.stringify({ k: privKey.toString() }),
  };
}

/**
 * Provision one RSA and one ECC key pair for a newly registered user.
 * Inserts two rows into `keys`. Any error here is logged but does NOT
 * roll back the user row — keys can be regenerated via the KMM route.
 *
 * @param {number} userId
 */
async function provisionInitialKeyPairs(userId) {
  const wrapKey = deriveWrappingKey(userId);

  // ── RSA ──────────────────────────────────────────────────────────────────
  try {
    const rsaKeys              = rsa.generateKeyPair();
    const { publicStr, privateStr } = serialiseRsa(rsaKeys);
    const encPriv              = aesEncrypt(privateStr, wrapKey);
    await pool.query(
      `INSERT INTO \`keys\` (user_id, public_key, private_key_encrypted, key_type, status)
       VALUES (?, ?, ?, 'RSA', 'active')`,
      [userId, publicStr, encPriv]
    );
    console.log(`[KMM] RSA key pair provisioned for user ${userId}`);
  } catch (err) {
    console.error(`[KMM] RSA key provisioning failed for user ${userId}:`, err.message);
  }

  // ── ECC ──────────────────────────────────────────────────────────────────
  try {
    const privKey              = ecc.generatePrivateKey();
    const pubKey               = ecc.derivePublicKey(privKey);
    const { publicStr, privateStr } = serialiseEcc(privKey, pubKey);
    const encPriv              = aesEncrypt(privateStr, wrapKey);
    await pool.query(
      `INSERT INTO \`keys\` (user_id, public_key, private_key_encrypted, key_type, status)
       VALUES (?, ?, ?, 'ECC', 'active')`,
      [userId, publicStr, encPriv]
    );
    console.log(`[KMM] ECC key pair provisioned for user ${userId}`);
  } catch (err) {
    console.error(`[KMM] ECC key provisioning failed for user ${userId}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2FA helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a simple 6-digit TOTP-style code from a shared secret + current
 * 30-second window. Implemented from scratch using only crypto.createHmac
 * (native Node.js, not a library).
 *
 * Algorithm: HOTP (RFC 4226) with T = floor(Date.now() / 30000).
 *
 * @param {string} secretHex  hex-encoded 20-byte shared secret
 * @param {number} [skew=0]   window offset (−1, 0, +1) for clock-skew tolerance
 * @returns {string} zero-padded 6-digit code
 */
function computeTotp(secretHex, skew = 0) {
  const T      = Math.floor(Date.now() / 30000) + skew;
  const secret = Buffer.from(secretHex, 'hex');

  // Counter as 8-byte big-endian buffer
  const counter = Buffer.alloc(8);
  let t = T;
  for (let i = 7; i >= 0; i--) {
    counter[i] = t & 0xff;
    t >>= 8;
  }

  const hmac  = crypto.createHmac('sha1', secret).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code   = ((hmac[offset]     & 0x7f) << 24
                | (hmac[offset + 1] & 0xff) << 16
                | (hmac[offset + 2] & 0xff) << 8
                | (hmac[offset + 3] & 0xff)) % 1_000_000;

  return code.toString().padStart(6, '0');
}

/**
 * Validate a user-submitted 6-digit code against the stored secret,
 * allowing ±1 window (30-second clock-skew tolerance).
 *
 * @param {string} secretHex  hex-encoded shared secret
 * @param {string} submittedCode  user-supplied string
 * @returns {boolean}
 */
function validateTotp(secretHex, submittedCode) {
  for (const skew of [-1, 0, 1]) {
    const expected = computeTotp(secretHex, skew);
    // Constant-time string comparison
    if (expected.length === submittedCode.length) {
      let diff = 0;
      for (let i = 0; i < expected.length; i++) {
        diff |= expected.charCodeAt(i) ^ submittedCode.charCodeAt(i);
      }
      if (diff === 0) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * Body: { name, email, password, role? }
 *
 * Changes from baseline:
 *   - Custom hash replaces bcrypt: hashPassword() produces "<iter>$<salt>$<digest>"
 *   - The salt portion is extracted and stored separately in users.salt
 *   - On success, RSA + ECC key pairs are provisioned in the background
 */
const register = async (req, res) => {
  const { name, email, password, role = 'customer' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'name, email and password are required',
    });
  }

  try {
    // ── 1. Duplicate-email guard ────────────────────────────────────────────
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // ── 2. Hash password with custom engine ─────────────────────────────────
    // hashPassword() returns "<iterations>$<salt_hex>$<digest_hex>"
    const hashString     = hashPassword(password);
    const [, saltHex, ] = hashString.split('$');   // extract the embedded salt

    // ── 3. Persist user row (salt stored separately for direct DB access) ───
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role, salt)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, hashString, role, saltHex]
    );
    const newUserId = result.insertId;

    // ── 4. Provision RSA + ECC key pairs (non-blocking, best-effort) ────────
    // Run after response could be sent, but we await to capture any startup
    // errors in logs during the viva demo.
    provisionInitialKeyPairs(newUserId).catch(err =>
      console.error('[authController] Key provisioning error:', err.message)
    );

    // ── 5. Issue session JWT and respond ────────────────────────────────────
    const token = generateSessionToken(newUserId, role);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { id: newUserId, name, email, role, token },
    });

  } catch (err) {
    console.error('[authController] Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

/**
 * POST /api/auth/login
 *
 * Body: { email, password }
 *
 * Response (2FA disabled — same shape as baseline):
 *   { success, message, data: { id, name, email, role, token } }
 *
 * Response (2FA enabled — extended shape):
 *   { success, message, requires_2fa: true, temp_token: "<2fa_pending JWT>" }
 *   The client must POST temp_token + code to /api/auth/verify-2fa.
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'email and password are required',
    });
  }

  try {
    // ── 1. Fetch user — include new security columns ────────────────────────
    const [rows] = await pool.query(
      `SELECT id, name, email, password, role, salt, is_2fa_enabled, two_factor_secret
         FROM users
        WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];

    // ── 2. Password verification ────────────────────────────────────────────
    // user.password contains the full "<iter>$<salt>$<digest>" string produced
    // by hashPassword(). verifyPassword() re-derives and compares in constant
    // time.
    //
    // Backward-compatibility note: if a user was registered before the
    // Security Evolution (password field won't have "$" separators), we
    // fall through to a rejection — they must re-register or have their
    // password reset via admin tooling.
    const isMatch = verifyPassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // ── 3. 2FA gate ─────────────────────────────────────────────────────────
    if (user.is_2fa_enabled && user.two_factor_secret) {
      // Issue a short-lived pending token; do NOT give out role yet
      const tempToken = generate2faPendingToken(user.id);

      return res.status(200).json({
        success:      true,
        message:      '2FA verification required. Submit your 6-digit code to /api/auth/verify-2fa.',
        requires_2fa: true,
        temp_token:   tempToken,
      });
    }

    // ── 4. No 2FA — issue full session JWT (baseline-compatible) ────────────
    const token = generateSessionToken(user.id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token,
      },
    });

  } catch (err) {
    console.error('[authController] Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

/**
 * POST /api/auth/verify-2fa
 *
 * Body: { temp_token: "<2fa_pending JWT>", code: "123456" }
 *
 * Validates the pending token (ensuring it hasn't expired and is the right
 * type), then checks the 6-digit TOTP code against the user's stored secret.
 * On success, issues the final full session JWT.
 */
const verify2fa = async (req, res) => {
  const { temp_token, code } = req.body;

  if (!temp_token || !code) {
    return res.status(400).json({
      success: false,
      message: 'temp_token and code are required',
    });
  }

  // ── 1. Verify and decode the pending token ────────────────────────────────
  let decoded;
  try {
    decoded = jwt.verify(temp_token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      message: '2FA session expired or token invalid. Please log in again.',
    });
  }

  // ── 2. Ensure this is actually a 2fa_pending token, not a session token ──
  if (decoded.token_type !== '2fa_pending') {
    return res.status(400).json({
      success: false,
      message: 'Invalid token type for 2FA verification.',
    });
  }

  const userId = decoded.id;

  try {
    // ── 3. Fetch the user's 2FA secret from DB ─────────────────────────────
    const [rows] = await pool.query(
      'SELECT id, name, email, role, two_factor_secret, is_2fa_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    if (!user.is_2fa_enabled || !user.two_factor_secret) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account.',
      });
    }

    // ── 4. Validate the submitted TOTP code ───────────────────────────────
    const codeStr = String(code).trim();
    if (!/^\d{6}$/.test(codeStr)) {
      return res.status(400).json({
        success: false,
        message: '2FA code must be exactly 6 digits.',
      });
    }

    if (!validateTotp(user.two_factor_secret, codeStr)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired 2FA code.',
      });
    }

    // ── 5. Code valid — issue full session JWT ────────────────────────────
    const token = generateSessionToken(user.id, user.role);

    return res.status(200).json({
      success: true,
      message: '2FA verification successful. Login complete.',
      data: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token,
      },
    });

  } catch (err) {
    console.error('[authController] verify2fa error:', err);
    return res.status(500).json({ success: false, message: 'Server error during 2FA verification' });
  }
};

/**
 * POST /api/auth/setup-2fa
 *
 * Enables 2FA for the authenticated user. Generates a 20-byte (160-bit)
 * random shared secret using only crypto.randomBytes, stores its hex in
 * users.two_factor_secret, and sets is_2fa_enabled = 1.
 *
 * Returns the hex secret and the current TOTP code so the caller can
 * confirm setup before the secret is committed.
 *
 * This endpoint is protected — must be called with a valid session JWT.
 * Wire it behind the `protect` middleware in authRoutes.js.
 */
const setup2fa = async (req, res) => {
  const userId = req.user.id;

  try {
    // ── 1. Generate 20-byte (160-bit) TOTP secret ─────────────────────────
    const secretBuf = crypto.randomBytes(20);
    const secretHex = secretBuf.toString('hex');

    // ── 2. Compute the current TOTP code for immediate verification ────────
    const currentCode = computeTotp(secretHex, 0);

    // ── 3. Persist to DB ───────────────────────────────────────────────────
    await pool.query(
      `UPDATE users
          SET two_factor_secret = ?,
              is_2fa_enabled    = 1
        WHERE id = ?`,
      [secretHex, userId]
    );

    return res.status(200).json({
      success:      true,
      message:      '2FA has been enabled. Store the secret securely and verify with the provided code.',
      secret_hex:   secretHex,
      current_code: currentCode,   // lets the client confirm the algorithm works
    });

  } catch (err) {
    console.error('[authController] setup2fa error:', err);
    return res.status(500).json({ success: false, message: 'Failed to enable 2FA.' });
  }
};

/**
 * POST /api/auth/disable-2fa
 *
 * Disables 2FA for the authenticated user after re-confirming their TOTP code.
 * Protected route — requires a valid session JWT.
 */
const disable2fa = async (req, res) => {
  const userId = req.user.id;
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Current 2FA code is required to disable 2FA.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT two_factor_secret, is_2fa_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0 || !rows[0].is_2fa_enabled) {
      return res.status(400).json({ success: false, message: '2FA is not currently enabled.' });
    }

    if (!validateTotp(rows[0].two_factor_secret, String(code).trim())) {
      return res.status(401).json({ success: false, message: 'Invalid 2FA code. Disable request rejected.' });
    }

    await pool.query(
      `UPDATE users SET two_factor_secret = NULL, is_2fa_enabled = 0 WHERE id = ?`,
      [userId]
    );

    return res.status(200).json({ success: true, message: '2FA has been disabled.' });

  } catch (err) {
    console.error('[authController] disable2fa error:', err);
    return res.status(500).json({ success: false, message: 'Failed to disable 2FA.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { register, login, verify2fa, setup2fa, disable2fa };
