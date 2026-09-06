/**
 * backend/security/rsa.js
 * ─────────────────────────────────────────────────────────────────────────────
 * From-scratch RSA engine.
 *
 * Constraints:
 *  • No crypto.subtle, no bcrypt, no third-party libraries.
 *  • crypto.randomBytes() is the only native-crypto surface used.
 *  • All arithmetic is BigInt to avoid precision loss.
 *
 * Key size: 128-bit primes → 256-bit modulus.
 * NOTE: 128-bit keys are intentionally small for demonstration / academic use
 *       only. Production RSA requires ≥2048-bit moduli.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

// ─── Low-level BigInt helpers ────────────────────────────────────────────────

/**
 * Generate a cryptographically random BigInt of exactly `bits` bits.
 * The top bit is always set so the number is truly `bits` bits wide.
 * @param {number} bits
 * @returns {BigInt}
 */
function randomBigInt(bits) {
  const bytes = Math.ceil(bits / 8);
  const buf = crypto.randomBytes(bytes);
  // Force the most-significant bit to 1 so we get a full-width number.
  buf[0] |= 0x80;
  // Mask any extra bits if bytes*8 > bits
  const excess = bytes * 8 - bits;
  if (excess > 0) buf[buf.length - 1] &= 0xff >> excess;
  return BigInt('0x' + buf.toString('hex'));
}

/**
 * Modular exponentiation: base^exp mod m  (square-and-multiply, left-to-right).
 * @param {BigInt} base
 * @param {BigInt} exp
 * @param {BigInt} mod
 * @returns {BigInt}
 */
function modPow(base, exp, mod) {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Extended Euclidean Algorithm.
 * Returns { gcd, x, y } such that a*x + b*y = gcd.
 * @param {BigInt} a
 * @param {BigInt} b
 * @returns {{ gcd: BigInt, x: BigInt, y: BigInt }}
 */
function extendedGcd(a, b) {
  if (b === 0n) return { gcd: a, x: 1n, y: 0n };
  const { gcd, x: x1, y: y1 } = extendedGcd(b, a % b);
  return { gcd, x: y1, y: x1 - (a / b) * y1 };
}

/**
 * Modular inverse of a modulo m (a and m must be coprime).
 * @param {BigInt} a
 * @param {BigInt} m
 * @returns {BigInt}
 */
function modInverse(a, m) {
  const { gcd, x } = extendedGcd(((a % m) + m) % m, m);
  if (gcd !== 1n) throw new Error('Modular inverse does not exist (not coprime).');
  return ((x % m) + m) % m;
}

// ─── Primality testing ───────────────────────────────────────────────────────

/**
 * Miller-Rabin primality test.
 * @param {BigInt} n   - candidate prime
 * @param {number} k   - rounds (25 gives negligible false-positive rate for 128-bit numbers)
 * @returns {boolean}
 */
function millerRabin(n, k = 25) {
  if (n < 2n)  return false;
  if (n === 2n || n === 3n) return true;
  if (n % 2n === 0n) return false;

  // Write n-1 as 2^r * d
  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) { d >>= 1n; r++; }

  const nBits = n.toString(2).length;

  outer: for (let i = 0; i < k; i++) {
    // Random witness a in [2, n-2]
    let a;
    do {
      a = randomBigInt(nBits);
    } while (a < 2n || a > n - 2n);

    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;

    for (let j = 0n; j < r - 1n; j++) {
      x = modPow(x, 2n, n);
      if (x === n - 1n) continue outer;
    }
    return false; // Composite
  }
  return true; // Probably prime
}

/**
 * Generate a random 128-bit prime using Miller-Rabin.
 * @returns {BigInt}
 */
function generatePrime128() {
  while (true) {
    let candidate = randomBigInt(128);
    candidate |= 1n; // Ensure odd
    if (millerRabin(candidate, 25)) return candidate;
  }
}

// ─── RSA Key Generation ──────────────────────────────────────────────────────

/**
 * Generate an RSA key pair with 128-bit primes (256-bit modulus).
 *
 * Returns:
 *  {
 *    publicKey:  { e, n },
 *    privateKey: { d, n },
 *    p, q, phi   <- exposed for academic / inspection purposes only
 *  }
 */
function generateKeyPair() {
  const e = 65537n;
  let p, q, n, phi;

  // p and q must be distinct and phi must be coprime with e
  do {
    p = generatePrime128();
    q = generatePrime128();
    n   = p * q;
    phi = (p - 1n) * (q - 1n);
  } while (p === q || extendedGcd(e, phi).gcd !== 1n);

  const d = modInverse(e, phi);

  return {
    publicKey:  { e, n },
    privateKey: { d, n },
    p,
    q,
    phi,
  };
}

// ─── RSA Encrypt / Decrypt ───────────────────────────────────────────────────

/**
 * Encrypt a plaintext BigInt with the RSA public key.
 * Requires: 0 <= plaintext < n.
 * @param {BigInt} plaintext
 * @param {{ e: BigInt, n: BigInt }} publicKey
 * @returns {BigInt} ciphertext
 */
function encrypt(plaintext, publicKey) {
  const { e, n } = publicKey;
  if (plaintext < 0n || plaintext >= n) {
    throw new Error('Plaintext must satisfy 0 <= plaintext < n.');
  }
  return modPow(plaintext, e, n);
}

/**
 * Decrypt a ciphertext BigInt with the RSA private key.
 * @param {BigInt} ciphertext
 * @param {{ d: BigInt, n: BigInt }} privateKey
 * @returns {BigInt} plaintext
 */
function decrypt(ciphertext, privateKey) {
  const { d, n } = privateKey;
  return modPow(ciphertext, d, n);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  randomBigInt,
  generatePrime128,
  generateKeyPair,
  modPow,
  modInverse,
  extendedGcd,
  encrypt,
  decrypt,
};

// ─── Self-test (run with: node backend/security/rsa.js) ──────────────────────
if (require.main === module) {
  console.log('=== RSA Engine Self-Test ===\n');

  console.log('[1] Generating two independent 128-bit primes...');
  const p1 = generatePrime128();
  const p2 = generatePrime128();
  console.log(`    p1 = ${p1}`);
  console.log(`    p2 = ${p2}`);
  console.log(`    Miller-Rabin(p1) = ${millerRabin(p1)}`);
  console.log(`    Miller-Rabin(p2) = ${millerRabin(p2)}\n`);

  console.log('[2] Generating RSA key pair (256-bit modulus)...');
  const keys = generateKeyPair();
  console.log(`    p   = ${keys.p}`);
  console.log(`    q   = ${keys.q}`);
  console.log(`    n   = ${keys.publicKey.n}`);
  console.log(`    phi = ${keys.phi}`);
  console.log(`    e   = ${keys.publicKey.e}`);
  console.log(`    d   = ${keys.privateKey.d}\n`);

  console.log('[3] Encrypt / Decrypt round-trip...');
  const message = 123456789n;
  console.log(`    Plaintext : ${message}`);
  const ct = encrypt(message, keys.publicKey);
  console.log(`    Ciphertext: ${ct}`);
  const pt = decrypt(ct, keys.privateKey);
  console.log(`    Decrypted : ${pt}`);
  console.log(`    Round-trip OK: ${pt === message}\n`);

  console.log('[4] modPow sanity check: 2^10 mod 1000 =', modPow(2n, 10n, 1000n), '(expected 24)');
  console.log('[5] modInverse: inv(3, 11) =', modInverse(3n, 11n), '(expected 4, since 3*4=12≡1 mod 11)');
}
