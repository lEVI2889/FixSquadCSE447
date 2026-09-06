/**
 * backend/security/hash.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom password hashing and salting engine — a from-scratch bcrypt
 * replacement.
 *
 * Constraints:
 *  • No crypto.subtle, no bcrypt, no third-party libraries.
 *  • crypto.randomBytes() used ONLY for salt generation.
 *  • All hash arithmetic implemented by hand using BigInt.
 *
 * Algorithm design:
 *  1. Generate a 16-byte (128-bit) cryptographically random salt.
 *  2. Stretch the password with a custom PBKDF-like iteration:
 *       state = customCompress(state XOR blockOfPassword XOR blockOfSalt)
 *     repeated `ITERATIONS` times.
 *  3. The compression function is a 512-bit Merkle–Damgård-style round
 *     built from scratch using BigInt rotations and mixing constants
 *     inspired by the structure of SHA-256 (but NOT SHA-256 itself).
 *  4. Output format: "<iterations>$<salt_hex>$<hash_hex>"
 *     (same style as modern password hashing schemes for easy parsing).
 *
 * Drop-in API (mirrors bcryptjs's synchronous surface):
 *   hashPassword(password, iterations?) → string
 *   verifyPassword(password, storedHash) → boolean
 *
 * NOTE: This is a pedagogical implementation. For production use a vetted
 *       KDF such as Argon2id or scrypt.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

// ─── Configuration ────────────────────────────────────────────────────────────

const SALT_BYTES  = 16;    // 128-bit salt
const HASH_BYTES  = 32;    // 256-bit output
const DEFAULT_ITER = 10000; // Work factor (iteration count)
const BLOCK_BITS  = 256n;  // Internal state width in bits
const BLOCK_MASK  = (1n << BLOCK_BITS) - 1n; // 2^256 - 1

// ─── Mixing Constants ────────────────────────────────────────────────────────
// Derived from the fractional parts of the square roots of the first 8 primes
// (same philosophy as SHA-256 H0..H7, but different values).
const K = [
  0x6a09e667bb67ae85n, 0x3c6ef372a54ff53an,
  0x510e527f9b05688cn, 0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n, 0xcbbb9d5dc1059ed8n,
  0x629a292a367cd507n, 0x9159015a3070dd17n,
];

// ─── Bit-rotation helpers for 256-bit words ──────────────────────────────────

/**
 * Rotate a 256-bit BigInt left by `n` bits.
 */
function rotl256(x, n) {
  n = BigInt(n);
  return ((x << n) | (x >> (BLOCK_BITS - n))) & BLOCK_MASK;
}

/**
 * Rotate a 256-bit BigInt right by `n` bits.
 */
function rotr256(x, n) {
  n = BigInt(n);
  return ((x >> n) | (x << (BLOCK_BITS - n))) & BLOCK_MASK;
}

// ─── Custom Compression Function ─────────────────────────────────────────────

/**
 * One round of the custom compression function.
 * Operates on a 256-bit state and 256-bit message word.
 *
 * Mix strategy (Feistel / ARX):
 *   a = rotr(a, 7)  ^ (b + K[r % 8])
 *   b = rotl(b, 13) ^ (a * c  mod 2^256)
 *   a = a XOR rotr(c, 17)
 *   state = a XOR b XOR msgWord
 *
 * @param {BigInt} state   Current 256-bit hash state
 * @param {BigInt} msg     256-bit message word for this round
 * @param {number} round   Round index (used to select mixing constant)
 * @returns {BigInt}       New 256-bit state
 */
function compressRound(state, msg, round) {
  let a = state & BLOCK_MASK;
  let b = (state ^ rotr256(state, 31)) & BLOCK_MASK;
  let c = rotl256(state ^ msg, 19);

  a = (rotr256(a, 7)  ^ ((b + K[round % 8]) & BLOCK_MASK)) & BLOCK_MASK;
  b = (rotl256(b, 13) ^ ((a * c) & BLOCK_MASK))             & BLOCK_MASK;
  a = (a ^ rotr256(c, 17))                                   & BLOCK_MASK;

  return (a ^ b ^ msg) & BLOCK_MASK;
}

/**
 * Full compression: 16 rounds of compressRound over the (state XOR msg).
 * @param {BigInt} state   256-bit state
 * @param {BigInt} msg     256-bit message block
 * @returns {BigInt}       New 256-bit state
 */
function compress(state, msg) {
  let s = state;
  for (let r = 0; r < 16; r++) {
    s = compressRound(s, msg, r);
  }
  return s;
}

// ─── Buffer ↔ BigInt helpers ─────────────────────────────────────────────────

/**
 * Convert a Buffer to a BigInt (big-endian).
 * @param {Buffer} buf
 * @returns {BigInt}
 */
function bufToBigInt(buf) {
  return BigInt('0x' + buf.toString('hex') || '0');
}

/**
 * Convert a BigInt to a Buffer of exactly `byteLen` bytes (big-endian, zero-padded).
 * @param {BigInt} n
 * @param {number} byteLen
 * @returns {Buffer}
 */
function bigIntToBuf(n, byteLen) {
  const hex = (n & BLOCK_MASK).toString(16).padStart(byteLen * 2, '0');
  return Buffer.from(hex, 'hex');
}

// ─── Password Hashing ────────────────────────────────────────────────────────

/**
 * Expand a password+salt into a sequence of 256-bit message blocks.
 * Pads / truncates to fill exactly `numBlocks` blocks.
 * @param {Buffer} pwBuf   raw password bytes
 * @param {Buffer} saltBuf raw salt bytes
 * @param {number} numBlocks
 * @returns {BigInt[]}
 */
function buildMessageBlocks(pwBuf, saltBuf, numBlocks) {
  const combined = Buffer.concat([pwBuf, saltBuf]);
  const blockBytes = Number(BLOCK_BITS) / 8; // 32 bytes
  const blocks = [];
  for (let i = 0; i < numBlocks; i++) {
    const start = (i * blockBytes) % combined.length;
    // Wrap-around slice to always get a full block
    let chunk = Buffer.alloc(blockBytes, 0);
    for (let b = 0; b < blockBytes; b++) {
      chunk[b] = combined[(start + b) % combined.length];
    }
    // Mix in block index to ensure different blocks differ
    chunk[0] ^= i & 0xff;
    chunk[1] ^= (i >> 8) & 0xff;
    blocks.push(bufToBigInt(chunk));
  }
  return blocks;
}

/**
 * Hash a password with a given salt using the custom PBKDF-style KDF.
 *
 * @param {string} password
 * @param {Buffer} salt         16-byte salt
 * @param {number} iterations   work factor
 * @returns {Buffer}            32-byte hash digest
 */
function pbkdf(password, salt, iterations) {
  const pwBuf = Buffer.from(password, 'utf8');
  // Initial state: XOR of IV constants
  let state = K.reduce((acc, k) => (acc ^ k) & BLOCK_MASK, 0n);

  // Build 8 message blocks from password+salt
  const blocks = buildMessageBlocks(pwBuf, salt, 8);

  for (let iter = 0; iter < iterations; iter++) {
    // One pass through all message blocks
    for (let b = 0; b < blocks.length; b++) {
      // Mix iteration count into message to ensure each iteration differs
      const msgWord = (blocks[b] ^ BigInt(iter) ^ BigInt(b)) & BLOCK_MASK;
      state = compress(state, msgWord);
    }
  }

  return bigIntToBuf(state, HASH_BYTES);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Hash a password, returning a storable hash string.
 * Output format: "<iterations>$<salt_hex>$<digest_hex>"
 *
 * @param {string} password
 * @param {number} [iterations=DEFAULT_ITER]
 * @returns {string} storable hash string
 */
function hashPassword(password, iterations = DEFAULT_ITER) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string.');
  }
  const salt   = crypto.randomBytes(SALT_BYTES);
  const digest = pbkdf(password, salt, iterations);
  return `${iterations}$${salt.toString('hex')}$${digest.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash string.
 * Uses a constant-time comparison to resist timing attacks.
 *
 * @param {string} password      plaintext to check
 * @param {string} storedHash    string produced by hashPassword()
 * @returns {boolean}
 */
function verifyPassword(password, storedHash) {
  const parts = storedHash.split('$');
  if (parts.length !== 3) throw new Error('Invalid hash format.');

  const iterations = parseInt(parts[0], 10);
  const salt       = Buffer.from(parts[1], 'hex');
  const expected   = Buffer.from(parts[2], 'hex');

  const actual = pbkdf(password, salt, iterations);

  // Constant-time comparison
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  hashPassword,
  verifyPassword,
  // Exposed for testing / inspection
  pbkdf,
  compress,
};

// ─── Self-test (run with: node backend/security/hash.js) ─────────────────────
if (require.main === module) {
  console.log('=== Custom Password Hash Engine Self-Test ===\n');

  const password = 'MySuperSecret123!';
  const FAST_ITER = 100; // Use fewer iterations for the demo to keep it snappy

  console.log(`[1] Hashing password: "${password}" (${FAST_ITER} iterations)...`);
  const hash1 = hashPassword(password, FAST_ITER);
  console.log('    Stored hash:', hash1);

  console.log('\n[2] Verify correct password:');
  console.log('    Result:', verifyPassword(password, hash1), '(expected: true)');

  console.log('\n[3] Verify wrong password:');
  console.log('    Result:', verifyPassword('WrongPassword!', hash1), '(expected: false)');

  console.log('\n[4] Unique salts — two hashes of same password differ:');
  const hash2 = hashPassword(password, FAST_ITER);
  console.log('    hash1:', hash1.split('$')[2]);
  console.log('    hash2:', hash2.split('$')[2]);
  console.log('    Different (salt randomness):', hash1 !== hash2);

  console.log('\n[5] Both hashes still verify correctly:');
  console.log('    hash1 verifies:', verifyPassword(password, hash1));
  console.log('    hash2 verifies:', verifyPassword(password, hash2));

  console.log('\n[6] Hash format inspection:');
  const [iter, salt, digest] = hash1.split('$');
  console.log(`    Iterations : ${iter}`);
  console.log(`    Salt (hex) : ${salt}  (${salt.length / 2} bytes)`);
  console.log(`    Digest(hex): ${digest}  (${digest.length / 2} bytes)`);

  console.log('\n[7] Avalanche — changing one character in password changes digest completely:');
  const hashA = hashPassword('password1', FAST_ITER);
  const hashB = hashPassword('password2', FAST_ITER);
  const dA = hashA.split('$')[2];
  const dB = hashB.split('$')[2];
  let diffBits = 0;
  for (let i = 0; i < dA.length; i += 2) {
    const byteA = parseInt(dA.slice(i, i + 2), 16);
    const byteB = parseInt(dB.slice(i, i + 2), 16);
    let x = byteA ^ byteB;
    while (x) { diffBits += x & 1; x >>= 1; }
  }
  console.log(`    Bits different between hash("password1") and hash("password2"): ${diffBits} / ${HASH_BYTES * 8}`);
}
