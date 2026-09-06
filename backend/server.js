require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
// SPRINT 2 UPDATE (Naim's Week2_Naim_CONTRACT.md):
// Destructure isAdmin from authMiddleware to gate the /api/admin namespace.
const { protect, isAdmin } = require('./middleware/authMiddleware');

const app = express();
const serviceRoutes = require('./routes/serviceRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const messageRoutes = require('./routes/messageRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const bookingDashboardRoutes = require('./routes/bookingDashboardRoutes');

const availabilityRoutes = require('./routes/availabilityRoutes');
// Feature 11 (Provider Verification) + Feature 14 (Access Control) — Naim
const adminRoutes = require('./routes/adminRoutes');

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/services', protect, serviceRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/bookings', protect, bookingRoutes);
app.use('/api/messages', protect, messageRoutes);
app.use('/api/invoices', protect, invoiceRoutes);
app.use('/api/bookings', protect, bookingDashboardRoutes);

app.use('/api/availability', protect, availabilityRoutes);
// Admin routes: require a valid JWT (`protect`) AND admin role (`isAdmin`)
app.use('/api/admin', protect, isAdmin, adminRoutes);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Service Portfolio Manager API is running' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
