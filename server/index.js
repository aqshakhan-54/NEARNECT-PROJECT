require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { initEmailService } = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nearnect';

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'nearnect-api' });
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/bookings', require('./routes/bookings'));
app.use('/notifications', require('./routes/notifications'));
app.use('/messages', require('./routes/messages'));
app.use('/reviews', require('./routes/reviews'));
app.use('/workers', require('./routes/workers'));
app.use('/payments', require('./routes/payments'));
app.use('/upload', require('./routes/upload'));
app.use('/admin', require('./routes/admin'));

async function start() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: process.env.DB_NAME || undefined });
    console.log('Connected to MongoDB');
    
    // Initialize email service
    initEmailService();
    
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();



