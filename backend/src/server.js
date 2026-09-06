const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./config/db');
const categoryRoutes = require('./routes/categoryRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend integration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Health Check & Info
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    feature: 'Feature 12 - Global Category Manager',
    author: 'Naim',
    database: 'Raw SQL (mysql2)',
    timestamp: new Date().toISOString()
  });
});

// Category REST API routes
app.use('/api/categories', categoryRoutes);

// Catch-all 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

if (require.main === module) {
  db.testConnection().then(() => {
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Category Manager API Server running on port ${PORT}`);
      console.log(`📂 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📂 Category API: http://localhost:${PORT}/api/categories`);
      console.log(`====================================================`);
    });
  });
}

module.exports = app;