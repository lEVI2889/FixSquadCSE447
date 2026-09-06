/**
 * backend/security/ecc.js
 * ─────────────────────────────────────────────────────────────────────────────
 * From-scratch Elliptic Curve Cryptography (ECC) engine over a prime field.
 *
 * Constraints:
 *  • No crypto.subtle, no bcrypt, no third-party libraries.
 *  • crypto.randomBytes() used only for random scalar generation.
 *  • All field arithmetic uses JavaScript BigInt.
 *
 * Curve: Short Weierstrass form  y² ≡ x³ + ax + b  (mod p)
 *
 *   p  = 9223372036854775783  (a 63-bit prime, p ≡ 3 mod 4 so sqrt is cheap)
 *   a  = 2
 *   b  = 3
 *   G  = (2, 2377583036358183132)   ← verified on-curve
 *
 * NOTE: 63-bit parameters are for academic demonstration only.
 *       Production ECC uses 256-bit+ curves (secp256k1, P-256, Curve25519).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

// ─── Curve Parameters ────────────────────────────────────────────────────────

const CURVE = {
  p:  9223372036854775783n,   // 63-bit prime
  a:  2n,
  b:  3n,
  Gx: 2n,
  Gy: 2377583036358183132n,   // verified: Gy² ≡ Gx³ + 2·Gx + 3 (mod p)
  // Subgroup order (approximated as p for this demo; use a certified
  // order for production to prevent small-subgroup attacks).
  n:  9223372036854775783n,
};

/** The point at infinity — the additive identity of the group. */
const INFINITY = null;

// ─── Field Arithmetic ────────────────────────────────────────────────────────

/**
 * Reduce x into [0, p).
 * @param {BigInt} x
 * @param {BigInt} p
 * @returns {BigInt}
 */
function mod(x, p) {
  return ((x % p) + p) % p;
}

/**
 * Extended Euclidean Algorithm.
 * Returns { gcd, x, y } with a·x + b·y = gcd.
 */
function extGcd(a, b) {
  if (b === 0n) return { gcd: a, x: 1n, y: 0n };
  const { gcd, x: x1, y: y1 } = extGcd(b, a % b);
  return { gcd, x: y1, y: x1 - (a / b) * y1 };
}

/**
 * Modular inverse of a modulo p.
 * @param {BigInt} a
 * @param {BigInt} p
 * @returns {BigInt}
 */
function fieldInverse(a, p) {
  const { gcd, x } = extGcd(mod(a, p), p);
  if (gcd !== 1n) throw new Error(`${a} has no inverse mod ${p}`);
  return mod(x, p);
}

// ─── Point Validation ────────────────────────────────────────────────────────

/**
 * Verify that point P satisfies  y² ≡ x³ + ax + b  (mod p).
 * @param {{ x: BigInt, y: BigInt } | null} P
 * @param {object} [curve=CURVE]
 * @returns {boolean}
 */
function isOnCurve(P, curve = CURVE) {
  if (P === INFINITY) return true;
  const { x, y } = P;
  const { p, a, b } = curve;
  const lhs = mod(y * y, p);
  const rhs = mod(x * x * x + a * x + b, p);
  return lhs === rhs;
}

// ─── Point Negation ──────────────────────────────────────────────────────────

/**
 * Negate a point: -P = (x, -y mod p).
 * @param {{ x: BigInt, y: BigInt } | null} P
 * @param {object} [curve=CURVE]
 * @returns {{ x: BigInt, y: BigInt } | null}
 */
function negate(P, curve = CURVE) {
  if (P === INFINITY) return INFINITY;
  return { x: P.x, y: mod(-P.y, curve.p) };
}

// ─── Point Doubling ──────────────────────────────────────────────────────────

/**
 * Double a point: P + P.
 * Uses the tangent formula: λ = (3x² + a) / (2y) mod p.
 * @param {{ x: BigInt, y: BigInt } | null} P
 * @param {object} [curve=CURVE]
 * @returns {{ x: BigInt, y: BigInt } | null}
 */
function pointDouble(P, curve = CURVE) {
  if (P === INFINITY) return INFINITY;
  const { p, a } = curve;
  const { x, y } = P;

  if (y === 0n) return INFINITY; // tangent is vertical

  const lambda = mod(
    mod(3n * x * x + a, p) * fieldInverse(mod(2n * y, p), p),
    p
  );
  const x3 = mod(lambda * lambda - 2n * x, p);
  const y3 = mod(lambda * (x - x3) - y,   p);

  return { x: x3, y: y3 };
}

// ─── Point Addition ──────────────────────────────────────────────────────────

/**
 * Add two points P and Q on the curve (chord-and-tangent rule).
 * Automatically delegates to pointDouble when P === Q.
 * @param {{ x: BigInt, y: BigInt } | null} P
 * @param {{ x: BigInt, y: BigInt } | null} Q
 * @param {object} [curve=CURVE]
 * @returns {{ x: BigInt, y: BigInt } | null}
 */
function pointAdd(P, Q, curve = CURVE) {
  if (P === INFINITY) return Q;
  if (Q === INFINITY) return P;

  const { p } = curve;
  const { x: x1, y: y1 } = P;
  const { x: x2, y: y2 } = Q;

  // P + (-P) = INFINITY
  if (x1 === x2 && mod(y1 + y2, p) === 0n) return INFINITY;

  // P === Q → use doubling formula
  if (x1 === x2 && y1 === y2) return pointDouble(P, curve);

  // Slope: λ = (y2 - y1) / (x2 - x1) mod p
  const lambda = mod(
    mod(y2 - y1, p) * fieldInverse(mod(x2 - x1, p), p),
    p
  );
  const x3 = mod(lambda * lambda - x1 - x2, p);
  const y3 = mod(lambda * (x1 - x3) - y1,   p);

  return { x: x3, y: y3 };
}

// ─── Scalar Multiplication (double-and-add) ───────────────────────────────────

/**
 * Compute k·P using the binary double-and-add method.
 * Correctly handles k = 0 (returns INFINITY) and negative k.
 * @param {BigInt} k      scalar
 * @param {{ x: BigInt, y: BigInt } | null} P  curve point
 * @param {object} [curve=CURVE]
 * @returns {{ x: BigInt, y: BigInt } | null}
 */
function scalarMultiply(k, P, curve = CURVE) {
  if (k === 0n) return INFINITY;
  if (k < 0n)  return scalarMultiply(-k, negate(P, curve), curve);

  let result = INFINITY;
  let addend = P;

  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend, curve);
    addend = pointDouble(addend, curve);
    k >>= 1n;
  }
  return result;
}

// ─── Key Generation ──────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random private scalar k ∈ [1, n-1].
 * @param {object} [curve=CURVE]
 * @returns {BigInt}
 */
function generatePrivateKey(curve = CURVE) {
  const byteLen = Math.ceil(curve.n.toString(16).length / 2);
  let k;
  do {
    const buf = crypto.randomBytes(byteLen);
    k = BigInt('0x' + buf.toString('hex')) % curve.n;
  } while (k === 0n);
  return k;
}

/**
 * Derive the public key point (k·G) from a private scalar.
 * @param {BigInt} privateKey
 * @param {object} [curve=CURVE]
 * @returns {{ x: BigInt, y: BigInt }}
 */
function derivePublicKey(privateKey, curve = CURVE) {
  const G = { x: curve.Gx, y: curve.Gy };
  return scalarMultiply(privateKey, G, curve);
}

// ─── Utility: point to string ─────────────────────────────────────────────────

/**
 * Render a curve point as a human-readable string.
 * (Avoids JSON.stringify which cannot handle BigInt natively.)
 * @param {{ x: BigInt, y: BigInt } | null} P
 * @returns {string}
 */
function pointToString(P) {
  if (P === INFINITY) return 'INFINITY';
  return `{ x: ${P.x}, y: ${P.y} }`;
}

/**
 * Check structural equality of two curve points.
 * @param {{ x: BigInt, y: BigInt } | null} A
 * @param {{ x: BigInt, y: BigInt } | null} B
 * @returns {boolean}
 */
function pointEqual(A, B) {
  if (A === INFINITY && B === INFINITY) return true;
  if (A === INFINITY || B === INFINITY) return false;
  return A.x === B.x && A.y === B.y;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  CURVE,
  INFINITY,
  mod,
  fieldInverse,
  isOnCurve,
  pointAdd,
  pointDouble,
  scalarMultiply,
  negate,
  generatePrivateKey,
  derivePublicKey,
  pointEqual,
  pointToString,
};

// ─── Self-test (run with: node backend/security/ecc.js) ──────────────────────
if (require.main === module) {
  console.log('=== ECC Engine Self-Test ===\n');

  const G = { x: CURVE.Gx, y: CURVE.Gy };
  console.log('[1] Generator point G =', pointToString(G));
  console.log('    G on curve:', isOnCurve(G));

  console.log('\n[2] Point Doubling: 2G =');
  const G2 = pointDouble(G);
  console.log('   ', pointToString(G2));
  console.log('    2G on curve:', isOnCurve(G2));

  console.log('\n[3] Point Addition: G + 2G = 3G (via addition) =');
  const G3_add = pointAdd(G, G2);
  console.log('   ', pointToString(G3_add));
  console.log('    3G on curve:', isOnCurve(G3_add));

  console.log('\n[4] Scalar Multiplication: 3·G (via double-and-add) =');
  const G3_mul = scalarMultiply(3n, G);
  console.log('   ', pointToString(G3_mul));
  console.log('    Addition == Scalar Mul:', pointEqual(G3_add, G3_mul));

  console.log('\n[5] ECDH Key Exchange Demo:');
  const alicePriv = generatePrivateKey();
  const bobPriv   = generatePrivateKey();
  const alicePub  = derivePublicKey(alicePriv);
  const bobPub    = derivePublicKey(bobPriv);
  // Both sides compute the same shared secret: Alice computes a·(b·G), Bob computes b·(a·G)
  const sharedA   = scalarMultiply(alicePriv, bobPub);
  const sharedB   = scalarMultiply(bobPriv, alicePub);
  console.log('    Alice private :', alicePriv);
  console.log('    Bob   private :', bobPriv);
  console.log('    Alice public  :', pointToString(alicePub));
  console.log('    Bob   public  :', pointToString(bobPub));
  console.log('    Shared (Alice):', pointToString(sharedA));
  console.log('    Shared (Bob)  :', pointToString(sharedB));
  console.log('    Shared secrets match:', pointEqual(sharedA, sharedB));

  console.log('\n[6] Identity element: G + INFINITY = G?');
  const sum = pointAdd(G, INFINITY);
  console.log('    Result:', pointToString(sum), '| Match:', pointEqual(sum, G));

  console.log('\n[7] Inverse: G + (-G) = INFINITY?');
  const negG = negate(G);
  const inf  = pointAdd(G, negG);
  console.log('   -G =', pointToString(negG));
  console.log('    G + (-G) =', pointToString(inf), '| Is INFINITY:', inf === INFINITY);

  console.log('\n[8] Associativity: (G+G)+G == G+(G+G)?');
  const lhs = pointAdd(pointAdd(G, G), G);
  const rhs = pointAdd(G, pointAdd(G, G));
  console.log('    LHS:', pointToString(lhs));
  console.log('    RHS:', pointToString(rhs));
  console.log('    Equal:', pointEqual(lhs, rhs));
}
