/**
 * backend/security/rsaTextCodec.js
 * ─────────────────────────────────────────────────────────────────────────────
 * RSA Text Codec — hybrid block-encoding layer on top of rsa.js
 *
 * Problem: textbook RSA requires plaintext m < n. Our 256-bit modulus holds
 * at most 30 bytes per block. Arbitrary text is therefore split into chunks,
 * each encrypted independently, with the ORIGINAL BYTE LENGTH of each chunk
 * stored so decryption can reconstruct exactly — no padding ambiguity.
 *
 * Wire format stored in the database:
 *   "RSA:<ct0_len>:<ct0>,<ct1_len>:<ct1>,..."
 *   where each <ctN> is the decimal string of one RSA ciphertext BigInt,
 *   and <ctN_len> is the original byte length of that plaintext chunk.
 *
 * The "RSA:" outer prefix lets decryption detect unencrypted legacy records
 * and pass them through untouched → backward-compatible during migration.
 *
 * Constraints: no crypto.subtle, no third-party libs, rsa.js for math only.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const rsa = require('./rsa');

// Max bytes per RSA block: 30 bytes → 240 bits, always < 256-bit modulus n
const CHUNK_BYTES = 30;

// Outer prefix that marks a field as RSA-encrypted
const RSA_PREFIX = 'RSA:';

// ─── Low-level helpers ────────────────────────────────────────────────────────

/**
 * Split a UTF-8 string into fixed-size (≤ CHUNK_BYTES) byte Buffers.
 * @param {string} text
 * @returns {Buffer[]}
 */
function textToChunks(text) {
  const buf    = Buffer.from(text, 'utf8');
  const chunks = [];
  for (let i = 0; i < buf.length; i += CHUNK_BYTES) {
    chunks.push(buf.slice(i, i + CHUNK_BYTES));
  }
  if (chunks.length === 0) chunks.push(Buffer.alloc(0)); // empty-string edge case
  return chunks;
}

/**
 * Buffer → BigInt (big-endian). Empty Buffer → 0n.
 * @param {Buffer} buf
 * @returns {BigInt}
 */
function bufToBigInt(buf) {
  if (buf.length === 0) return 0n;
  return BigInt('0x' + buf.toString('hex'));
}

/**
 * BigInt → Buffer of exactly `byteLen` bytes (big-endian, zero-padded left).
 * @param {BigInt} n
 * @param {number} byteLen
 * @returns {Buffer}
 */
function bigIntToBuf(n, byteLen) {
  if (byteLen === 0) return Buffer.alloc(0);
  const hex = n.toString(16).padStart(byteLen * 2, '0');
  return Buffer.from(hex, 'hex');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt an arbitrary-length plaintext string using the RSA public key.
 *
 * Wire format: "RSA:<len0>:<ct0>,<len1>:<ct1>,..."
 *   lenN = original byte count of that plaintext chunk (for exact recovery)
 *   ctN  = decimal RSA ciphertext BigInt
 *
 * @param {string} plaintext
 * @param {{ e: BigInt, n: BigInt }} publicKey
 * @returns {string} wire-format ciphertext string
 */
function rsaEncryptText(plaintext, publicKey) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('rsaEncryptText: plaintext must be a string');
  }

  const chunks  = textToChunks(plaintext);
  const encoded = chunks.map(chunk => {
    const m   = bufToBigInt(chunk);
    const ct  = rsa.encrypt(m, publicKey);
    // Store original chunk byte length alongside the ciphertext for exact recovery
    return `${chunk.length}:${ct.toString()}`;
  });

  return `${RSA_PREFIX}${encoded.join(',')}`;
}

/**
 * Decrypt a wire-format string produced by rsaEncryptText.
 *
 * If the value does NOT start with RSA_PREFIX it is returned unchanged
 * (legacy plaintext pass-through — backward-compatible with existing records).
 *
 * @param {string} ciphertext  wire string from the DB
 * @param {{ d: BigInt, n: BigInt }} privateKey
 * @returns {string} decrypted plaintext (or original value if not encrypted)
 */
function rsaDecryptText(ciphertext, privateKey) {
  if (typeof ciphertext !== 'string') return String(ciphertext ?? '');

  // Legacy pass-through
  if (!ciphertext.startsWith(RSA_PREFIX)) return ciphertext;

  const body    = ciphertext.slice(RSA_PREFIX.length);   // strip "RSA:"
  const entries = body.split(',');                        // one per chunk

  const plainChunks = entries.map(entry => {
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) throw new Error('rsaDecryptText: malformed entry — missing colon');

    const origLen = parseInt(entry.slice(0, colonIdx), 10);
    const ct      = BigInt(entry.slice(colonIdx + 1));
    const m       = rsa.decrypt(ct, privateKey);

    // Recover exactly origLen bytes — no guesswork, no NUL trimming needed
    return bigIntToBuf(m, origLen);
  });

  return Buffer.concat(plainChunks).toString('utf8');
}

/**
 * Attempt decryption and return a graceful fallback on failure.
 * Prevents a single corrupt/missing-key record from crashing a list endpoint.
 *
 * @param {string} ciphertext
 * @param {{ d: BigInt, n: BigInt } | null} privateKey
 * @param {string} [fallback='[encrypted]']
 * @returns {string}
 */
function safeRsaDecryptText(ciphertext, privateKey, fallback = '[encrypted]') {
  if (!privateKey) return fallback;
  if (ciphertext === null || ciphertext === undefined) return ciphertext;
  try {
    return rsaDecryptText(ciphertext, privateKey);
  } catch (err) {
    console.warn('[rsaTextCodec] Decryption failed:', err.message);
    return fallback;
  }
}

/**
 * Return true if the value is an RSA-encrypted wire string.
 * @param {string} value
 * @returns {boolean}
 */
function isRsaEncrypted(value) {
  return typeof value === 'string' && value.startsWith(RSA_PREFIX);
}

module.exports = {
  rsaEncryptText,
  rsaDecryptText,
  safeRsaDecryptText,
  isRsaEncrypted,
  CHUNK_BYTES,
  RSA_PREFIX,
};

// ─── Self-test (node backend/security/rsaTextCodec.js) ────────────────────────
if (require.main === module) {
  const rsa = require('./rsa');
  console.log('=== RSA Text Codec Self-Test ===\n');

  const keys = rsa.generateKeyPair();
  console.log('Key pair generated. n (first 20 digits):', keys.publicKey.n.toString().slice(0, 20) + '...\n');

  const tests = [
    'Hello, FixSquad!',
    'This is a longer description that exceeds one RSA block and needs multiple chunks to encode correctly.',
    'Special chars: émoji 🔐 and unicode: 你好世界',
    '',                       // empty string
    'A',                      // single character
    'x'.repeat(300),          // large payload
  ];

  let allPassed = true;
  for (const text of tests) {
    const ct  = rsaEncryptText(text, keys.publicKey);
    const pt  = rsaDecryptText(ct, keys.privateKey);
    const ok  = pt === text;
    if (!ok) allPassed = false;

    const preview = text.length > 50 ? text.slice(0, 50) + '…' : (text || '(empty)');
    console.log(`Text   : "${preview}"`);
    console.log(`Cipher : ${ct.slice(0, 55)}...`);
    console.log(`Decoded: "${(pt.length > 50 ? pt.slice(0, 50) + '…' : pt) || '(empty)'}"`);
    console.log(`Match  : ${ok ? '✓' : '✗ FAIL'}\n`);
  }

  console.log('Legacy pass-through:');
  const legacy = 'plain old description without RSA prefix';
  const legacyOut = safeRsaDecryptText(legacy, keys.privateKey);
  console.log('Input == Output:', legacy === legacyOut, '\n');

  console.log('safeRsaDecryptText with null key:');
  const ct2 = rsaEncryptText('secret', keys.publicKey);
  console.log('Result:', safeRsaDecryptText(ct2, null), '(expected: [encrypted])\n');

  console.log('isRsaEncrypted:');
  console.log('  encrypted string:', isRsaEncrypted(ct2));
  console.log('  plain string    :', isRsaEncrypted('hello'));

  console.log('\n' + (allPassed ? '✓ All tests passed.' : '✗ Some tests FAILED.'));
}
