const pool = require('../config/db');
const PDFDocument = require('pdfkit');

exports.downloadInvoice = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    // Verify user is part of the booking and it is completed
    const [bookings] = await pool.query(`
      SELECT b.*, s.name as service_name, c.name as customer_name, p.name as provider_name 
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN users c ON b.customer_id = c.id
      JOIN users p ON b.provider_id = p.id
      WHERE b.id = ? AND (b.customer_id = ? OR b.provider_id = ?)
    `, [bookingId, userId, userId]);

    if (bookings.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized or booking not found.' });
    }

    const booking = bookings[0];

    if (booking.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Invoices are only available for completed bookings.' });
    }

    // Check if invoice exists, if not create one
    let [invoices] = await pool.query('SELECT * FROM invoices WHERE booking_id = ?', [bookingId]);
    let invoice;
    if (invoices.length === 0) {
      const amount = booking.total_price;
      const [result] = await pool.query(
        'INSERT INTO invoices (booking_id, amount) VALUES (?, ?)',
        [bookingId, amount]
      );
      invoice = { id: result.insertId, booking_id: bookingId, amount, issued_at: new Date() };
    } else {
      invoice = invoices[0];
    }

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-disposition', `attachment; filename=invoice-${invoice.id}.pdf`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(25).text('Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice ID: #${invoice.id}`);
    doc.text(`Date Issued: ${new Date(invoice.issued_at).toLocaleDateString()}`);
    doc.moveDown();
    
    doc.text(`Booking Reference: #${booking.id}`);
    doc.text(`Service: ${booking.service_name}`);
    doc.text(`Customer: ${booking.customer_name}`);
    doc.text(`Provider: ${booking.provider_name}`);
    doc.text(`Service Date: ${new Date(booking.scheduled_date).toLocaleDateString()} at ${booking.scheduled_time}`);
    
    doc.moveDown(2);
    doc.fontSize(16).text('Charges', { underline: true });
    doc.moveDown();
    
    doc.fontSize(12).text(`Total Amount: $${invoice.amount}`);
    doc.moveDown(2);
    
    doc.fontSize(10).text('Thank you for using FixSquad!', { align: 'center', color: 'grey' });

    doc.end();

  } catch (err) {
    console.error('Error generating invoice:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
