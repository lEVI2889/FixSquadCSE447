/**
 * backend/controllers/messageController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Messaging Module — Dataset B Security Evolution
 *
 * ECC Confidentiality:
 * - Messages are encrypted at rest using the recipient's ECC public key via 
 *   our custom ECC hybrid codec (ElGamal-like masking in the 63-bit field).
 * - On retrieval, the backend automatically unwraps the ciphertext using the
 *   recipient's ECC private key, delivering plaintext to the frontend.
 *
 * CBC-MAC Integrity:
 * - A CBC-MAC signature is generated over the ECC ciphertext.
 * - On retrieval, the MAC is re-calculated and verified.
 * - If compromised/tampered, the payload is flagged as "Compromised".
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const pool = require('../config/db');
const { cbcMac } = require('../security/mac');
const { eccEncryptText, safeEccDecryptText, ECC_PREFIX } = require('../security/eccTextCodec');
const { loadPrivateKey } = require('./security/keyController');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch a user's ECC public key from the KMM.
 */
async function fetchEccPublicKey(userId) {
  const [rows] = await pool.query(
    `SELECT public_key
       FROM \`keys\`
      WHERE user_id = ? AND key_type = 'ECC' AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return null;
  try {
    const parsed = JSON.parse(rows[0].public_key);
    return { x: BigInt(parsed.x), y: BigInt(parsed.y) };
  } catch {
    return null;
  }
}

const MAC_KEY = process.env.JWT_SECRET || 'fixsquad-mac-secret-fallback';

// ── Route Handlers ───────────────────────────────────────────────────────────

exports.getMessages = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    // Verify user is part of the booking and get both participants
    const [bookings] = await pool.query(
      'SELECT id, customer_id, provider_id FROM bookings WHERE id = ? AND (customer_id = ? OR provider_id = ?)',
      [bookingId, userId, userId]
    );

    if (bookings.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to view messages for this booking.' });
    }

    const { customer_id, provider_id } = bookings[0];

    // Pre-load ECC private keys for both participants (so we can decrypt sent & received messages)
    const privKeys = {
      [customer_id]: await loadPrivateKey(customer_id, 'ECC').then(k => k ? k.k : null).catch(() => null),
      [provider_id]: await loadPrivateKey(provider_id, 'ECC').then(k => k ? k.k : null).catch(() => null),
    };

    const [messages] = await pool.query(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.booking_id = ?
      ORDER BY m.created_at ASC
    `, [bookingId]);

    // Process integrity and confidentiality
    const processedMessages = messages.map(m => {
      let isCompromised = false;

      // Only verify MAC if the message is actually encrypted (ECC prefix)
      // or if it has a mac_signature. This maintains backward compatibility.
      if (m.mac_signature && m.message_text) {
        const expectedMac = cbcMac(m.message_text, MAC_KEY);
        if (expectedMac !== m.mac_signature) {
          isCompromised = true;
        }
      }

      if (isCompromised) {
        m.message_text = "Compromised";
      } else if (m.message_text && m.message_text.startsWith(ECC_PREFIX)) {
        // Determine recipient (the user who didn't send it)
        const recipientId = (m.sender_id === customer_id) ? provider_id : customer_id;
        const recipientPrivKey = privKeys[recipientId];
        
        m.message_text = safeEccDecryptText(m.message_text, recipientPrivKey);
      }

      return m;
    });

    res.json({ success: true, data: processedMessages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { message_text } = req.body;
    const userId = req.user.id;

    if (!message_text || message_text.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message text cannot be empty' });
    }

    // Verify user is part of the booking
    const [bookings] = await pool.query(
      'SELECT id, customer_id, provider_id FROM bookings WHERE id = ? AND (customer_id = ? OR provider_id = ?)',
      [bookingId, userId, userId]
    );

    if (bookings.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to send messages for this booking.' });
    }

    const { customer_id, provider_id } = bookings[0];
    const recipientId = (userId === customer_id) ? provider_id : customer_id;

    // ── Apply ECC Confidentiality ──────────────────────────────────────────
    let ciphertext = message_text.trim();
    const recipientPubKey = await fetchEccPublicKey(recipientId);
    
    if (recipientPubKey) {
      ciphertext = eccEncryptText(ciphertext, recipientPubKey);
    } else {
      console.warn(`[messageController] No active ECC public key for recipient ${recipientId}. Storing plaintext.`);
    }

    // ── Apply CBC-MAC Integrity ────────────────────────────────────────────
    const macSignature = cbcMac(ciphertext, MAC_KEY);

    const [result] = await pool.query(
      'INSERT INTO messages (booking_id, sender_id, message_text, mac_signature) VALUES (?, ?, ?, ?)',
      [bookingId, userId, ciphertext, macSignature]
    );

    const [newMessage] = await pool.query(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [result.insertId]);

    // Format for the sender's immediate response (so they don't see ciphertext)
    const responseMsg = { ...newMessage[0] };
    responseMsg.message_text = message_text.trim();

    res.status(201).json({ success: true, data: responseMsg });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
