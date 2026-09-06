/**
 * backend/security/eccTextCodec.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ECC Text Codec — academic hybrid encryption using a 63-bit prime curve.
 *
 * Algorithm (ElGamal-like Masking in the Field):
 * Because mapping arbitrary text to a valid curve point (Koblitz encoding) is
 * computationally intensive and complex, we use the shared secret's x-coordinate
 * to mask the plaintext directly in the scalar field.
 *
 * For each 7-byte plaintext chunk `m` (56 bits, which is < p = 63 bits):
 *   1. Generate ephemeral key pair: `k`, `C1 = k * G`
 *   2. Compute shared point: `S = k * Y` (where Y is recipient public key)
 *   3. Mask the plaintext: `c2 = (m + S.x) mod p`
 *   4. Ciphertext for this chunk is the tuple `(C1.x, C1.y, c2)`
 *
 * Decryption for a chunk `(C1, c2)`:
 *   1. Recover shared point: `S = x * C1` (where x is recipient private key)
 *   2. Unmask plaintext: `m = (c2 - S.x) mod p`
 *
 * Wire format (stored in DB):
 *   "ECC:<chunkSize>:<C1x>,<C1y>,<c2>;<C1x>,<C1y>,<c2>;..."
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const ecc = require('./ecc');
const crypto = require('crypto');

const CHUNK_BYTES = 7; // 56 bits (fits safely inside our 63-bit p)
const ECC_PREFIX = 'ECC:';

/**
 * Buffer to BigInt (big-endian)
 */
function bufToBigInt(buf) {
  if (buf.length === 0) return 0n;
  return BigInt('0x' + buf.toString('hex'));
}

/**
 * BigInt to Buffer (big-endian, zero-padded left)
 */
function bigIntToBuf(n, byteLen) {
  if (byteLen === 0) return Buffer.alloc(0);
  const hex = n.toString(16).padStart(byteLen * 2, '0');
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a string using the recipient's ECC public key.
 * @param {string} plaintext
 * @param {{ x: BigInt, y: BigInt }} pubKey 
 * @returns {string} wire-format ciphertext
 */
function eccEncryptText(plaintext, pubKey) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('plaintext must be a string');
  }

  const buf = Buffer.from(plaintext, 'utf8');
  const chunks = [];
  for (let i = 0; i < buf.length; i += CHUNK_BYTES) {
    chunks.push(buf.slice(i, i + CHUNK_BYTES));
  }
  if (chunks.length === 0) chunks.push(Buffer.alloc(0));

  const encodedChunks = chunks.map(chunk => {
    const m = bufToBigInt(chunk);
    
    // Generate ephemeral key `k`
    const k = ecc.generatePrivateKey();
    const C1 = ecc.derivePublicKey(k);
    
    // Shared secret `S = k * pubKey`
    const S = ecc.scalarMultiply(k, pubKey);
    
    // Mask in the field: c2 = (m + S.x) mod p
    const c2 = (m + S.x) % ecc.CURVE.p;
    
    // Store original length to avoid padding issues
    return `${chunk.length}:${C1.x.toString()},${C1.y.toString()},${c2.toString()}`;
  });

  return `${ECC_PREFIX}${encodedChunks.join(';')}`;
}

/**
 * Decrypt a wire-format ciphertext using the recipient's ECC private key.
 * @param {string} ciphertext 
 * @param {BigInt} privKey 
 * @returns {string} plaintext
 */
function eccDecryptText(ciphertext, privKey) {
  if (typeof ciphertext !== 'string') return String(ciphertext ?? '');
  if (!ciphertext.startsWith(ECC_PREFIX)) return ciphertext; // Legacy passthrough

  const body = ciphertext.slice(ECC_PREFIX.length);
  const entries = body.split(';');

  const plainChunks = entries.map(entry => {
    const colonIdx = entry.indexOf(':');
    if (colonIdx === -1) throw new Error('Malformed ECC entry');
    
    const origLen = parseInt(entry.slice(0, colonIdx), 10);
    const parts = entry.slice(colonIdx + 1).split(',');
    if (parts.length !== 3) throw new Error('Malformed ECC ciphertext chunk');
    
    const C1 = { x: BigInt(parts[0]), y: BigInt(parts[1]) };
    const c2 = BigInt(parts[2]);
    
    // S = privKey * C1
    const S = ecc.scalarMultiply(privKey, C1);
    
    // m = (c2 - S.x) mod p
    let m = (c2 - S.x) % ecc.CURVE.p;
    if (m < 0n) m += ecc.CURVE.p;
    
    return bigIntToBuf(m, origLen);
  });

  return Buffer.concat(plainChunks).toString('utf8');
}

/**
 * Graceful fallback decryption
 */
function safeEccDecryptText(ciphertext, privKey, fallback = '[encrypted]') {
  if (!privKey) return fallback;
  if (!ciphertext) return ciphertext;
  try {
    return eccDecryptText(ciphertext, privKey);
  } catch (err) {
    console.warn('[eccTextCodec] Decryption failed:', err.message);
    return fallback;
  }
}

module.exports = {
  eccEncryptText,
  eccDecryptText,
  safeEccDecryptText,
  ECC_PREFIX
};

// Self-test
if (require.main === module) {
  console.log('=== ECC Text Codec Self-Test ===');
  const priv = ecc.generatePrivateKey();
  const pub = ecc.derivePublicKey(priv);
  
  const msg = "FixSquad secure messaging with ECC + emojis 🚀!";
  console.log('Original:', msg);
  
  const ct = eccEncryptText(msg, pub);
  console.log('Ciphertext preview:', ct.slice(0, 80) + '...');
  
  const pt = eccDecryptText(ct, priv);
  console.log('Decrypted:', pt);
  console.log('Match:', pt === msg);
}
