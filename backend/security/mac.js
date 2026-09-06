/**
 * backend/security/mac.js
 * ─────────────────────────────────────────────────────────────────────────────
 * From-scratch CBC-MAC engine for message integrity verification.
 *
 * Constraints:
 *  • No crypto.subtle, no bcrypt, no third-party libraries.
 *  • crypto.randomBytes() used for key and IV generation only.
 *  • Block cipher is a from-scratch SPN (Substitution-Permutation Network)
 *    operating on 64-bit (8-byte) blocks using BigInt arithmetic.
 *
 * Algorithm outline:
 *  1. Split padded message into 8-byte blocks.
 *  2. XOR each block with the previous ciphertext block (CBC chaining).
 *  3. Encrypt the XOR'd block with a lightweight SPN block cipher keyed
 *     by a 64-bit key derived from the user-supplied key material.
 *  4. The final cipher block is the CBC-MAC tag.
 *
 * NOTE: This is a pedagogical implementation. For production MAC use
 *       HMAC-SHA256 or AES-128-CBC-MAC with a certified AES implementation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_SIZE = 8; // bytes (64-bit block)
const ROUNDS     = 8; // SPN rounds

// 4-bit S-box (16 entries, index → substituted nibble)
const SBOX = [0xE, 0x4, 0xD, 0x1, 0x2, 0xF, 0xB, 0x8,
              0x3, 0xA, 0x6, 0xC, 0x5, 0x9, 0x0, 0x7];

// ─── Block Cipher (Lightweight SPN) ─────────────────────────────────────────

/**
 * Derive per-round sub-keys from a 64-bit master key using a simple
 * schedule: rotate left by (round * 7) bits and XOR with round constant.
 * @param {BigInt} masterKey   64-bit key as BigInt
 * @returns {BigInt[]}         Array of ROUNDS+1 sub-keys
 */
function keySchedule(masterKey) {
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;
  const keys = [];
  let k = masterKey & MASK64;
  for (let r = 0; r <= ROUNDS; r++) {
    keys.push(k);
    // Rotate left 7 bits within 64-bit word
    k = ((k << 7n) | (k >> 57n)) & MASK64;
    // XOR with a simple round constant (Feistel-style)
    k ^= BigInt(r + 1) * 0x9e3779b97f4a7c15n & MASK64;
  }
  return keys;
}

/**
 * Apply the 4-bit S-box to every nibble of a 64-bit word.
 * @param {BigInt} block
 * @returns {BigInt}
 */
function substituteNibbles(block) {
  let result = 0n;
  for (let i = 0; i < 16; i++) {
    const nibble = Number((block >> BigInt(i * 4)) & 0xFn);
    result |= BigInt(SBOX[nibble]) << BigInt(i * 4);
  }
  return result;
}

/**
 * Bit permutation: rotate the 64-bit block left by 13 bits.
 * (Simple fixed permutation for the demo SPN.)
 * @param {BigInt} block
 * @returns {BigInt}
 */
function permute(block) {
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;
  return ((block << 13n) | (block >> 51n)) & MASK64;
}

/**
 * Encrypt a single 64-bit block using the SPN.
 * @param {BigInt} block   plaintext block (64-bit BigInt)
 * @param {BigInt} key     64-bit key (BigInt)
 * @returns {BigInt}       ciphertext block (64-bit BigInt)
 */
function encryptBlock(block, key) {
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;
  const subkeys = keySchedule(key);
  let state = block & MASK64;

  for (let r = 0; r < ROUNDS; r++) {
    state ^= subkeys[r];         // Add round key
    state = substituteNibbles(state); // Substitution
    state = permute(state);           // Permutation
  }
  // Final key addition (whitening)
  state ^= subkeys[ROUNDS];
  return state & MASK64;
}

// ─── Padding (PKCS#7-style for 8-byte blocks) ────────────────────────────────

/**
 * Pad a Buffer to a multiple of BLOCK_SIZE using PKCS#7.
 * @param {Buffer} buf
 * @returns {Buffer}
 */
function pad(buf) {
  const padLen = BLOCK_SIZE - (buf.length % BLOCK_SIZE);
  const padding = Buffer.alloc(padLen, padLen);
  return Buffer.concat([buf, padding]);
}

// ─── Key Preparation ─────────────────────────────────────────────────────────

/**
 * Derive a 64-bit BigInt key from arbitrary-length key material (Buffer/string).
 * Uses a simple XOR-folding hash over the input bytes.
 * @param {Buffer|string} keyMaterial
 * @returns {BigInt}
 */
function deriveKey(keyMaterial) {
  const buf = Buffer.isBuffer(keyMaterial)
    ? keyMaterial
    : Buffer.from(keyMaterial, 'utf8');

  // XOR-fold into 8 bytes
  const acc = Buffer.alloc(BLOCK_SIZE, 0);
  for (let i = 0; i < buf.length; i++) {
    acc[i % BLOCK_SIZE] ^= buf[i];
  }
  return BigInt('0x' + acc.toString('hex'));
}

// ─── CBC-MAC ─────────────────────────────────────────────────────────────────

/**
 * Compute the CBC-MAC tag of `message` under `key`.
 *
 * @param {Buffer|string} message   - data to authenticate
 * @param {Buffer|string} keyMaterial - key (any length; internally folded to 64 bits)
 * @returns {string} hex-encoded 8-byte MAC tag
 */
function cbcMac(message, keyMaterial) {
  const key = deriveKey(keyMaterial);
  const msg = Buffer.isBuffer(message) ? message : Buffer.from(message, 'utf8');
  const padded = pad(msg);

  let prevBlock = 0n; // IV = 0 for CBC-MAC

  for (let i = 0; i < padded.length; i += BLOCK_SIZE) {
    const chunk = padded.slice(i, i + BLOCK_SIZE);
    const blockInt = BigInt('0x' + chunk.toString('hex'));
    const xored   = prevBlock ^ blockInt;
    prevBlock = encryptBlock(xored, key);
  }

  // Return the final 64-bit block as an 8-byte hex tag
  return prevBlock.toString(16).padStart(16, '0');
}

/**
 * Verify that a MAC tag matches the expected tag for a given message and key.
 * Uses a constant-time-like comparison to resist timing attacks.
 * @param {Buffer|string} message
 * @param {Buffer|string} keyMaterial
 * @param {string} expectedTag   hex-encoded tag from cbcMac()
 * @returns {boolean}
 */
function verifyMac(message, keyMaterial, expectedTag) {
  const computedTag = cbcMac(message, keyMaterial);
  // Constant-time comparison: XOR all bytes and check if sum is 0
  if (computedTag.length !== expectedTag.length) return false;
  let diff = 0;
  for (let i = 0; i < computedTag.length; i++) {
    diff |= computedTag.charCodeAt(i) ^ expectedTag.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Generate a cryptographically random 64-bit key for use with cbcMac.
 * @returns {Buffer} 8-byte random key
 */
function generateMacKey() {
  return crypto.randomBytes(BLOCK_SIZE);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  cbcMac,
  verifyMac,
  generateMacKey,
  encryptBlock,
  deriveKey,
  pad,
};

// ─── Self-test (run with: node backend/security/mac.js) ──────────────────────
if (require.main === module) {
  console.log('=== CBC-MAC Engine Self-Test ===\n');

  const key = 'secret-key-material';
  const message = 'Hello, FixSquad!';

  console.log('[1] Basic MAC generation:');
  const tag = cbcMac(message, key);
  console.log(`    Message : "${message}"`);
  console.log(`    Key     : "${key}"`);
  console.log(`    MAC Tag : ${tag}  (16 hex chars = 8 bytes)`);

  console.log('\n[2] Verification:');
  console.log('    Correct tag  :', verifyMac(message, key, tag));
  console.log('    Wrong message:', verifyMac('Hello, World!', key, tag));
  console.log('    Wrong key    :', verifyMac(message, 'wrong-key', tag));

  console.log('\n[3] Determinism — same inputs produce same tag:');
  const tag2 = cbcMac(message, key);
  console.log(`    tag1: ${tag}`);
  console.log(`    tag2: ${tag2}`);
  console.log(`    Equal: ${tag === tag2}`);

  console.log('\n[4] Key sensitivity — single bit change in key changes tag:');
  const tagA = cbcMac('test message', 'keyA');
  const tagB = cbcMac('test message', 'keyB');
  console.log(`    tag(keyA): ${tagA}`);
  console.log(`    tag(keyB): ${tagB}`);
  console.log(`    Different: ${tagA !== tagB}`);

  console.log('\n[5] Message sensitivity — single char change changes tag:');
  const tagM1 = cbcMac('Hello', key);
  const tagM2 = cbcMac('Hellp', key);
  console.log(`    tag("Hello"): ${tagM1}`);
  console.log(`    tag("Hellp"): ${tagM2}`);
  console.log(`    Different   : ${tagM1 !== tagM2}`);

  console.log('\n[6] Random key generation:');
  const rKey = generateMacKey();
  console.log('    Random key (hex):', rKey.toString('hex'));
  const tagR = cbcMac(message, rKey);
  console.log('    MAC with random key:', tagR);
}
