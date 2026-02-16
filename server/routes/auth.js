const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set. Set JWT_SECRET in your environment for secure tokens.');
}

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, password, role, skill, bio, price, availability, address, city, pincode, location } = req.body || {};
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedRole = role === 'worker' ? 'worker' : 'customer';
    
    // Build user data - include all worker fields if provided
    const userData = {
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      role: normalizedRole
    };
    
    // Add worker-specific fields if role is worker
    if (normalizedRole === 'worker') {
      if (skill) userData.skill = skill;
      if (bio) userData.bio = bio;
      if (price) userData.price = parseInt(price, 10) || 0;
      if (availability) userData.availability = availability;
      if (address) userData.address = address;
      if (city) userData.city = city;
      if (pincode) userData.pincode = pincode;
      if (location) userData.location = location;
    }
    
    const user = await User.create(userData);
    
    // Send welcome email (async, don't wait)
    sendWelcomeEmail(user.email, user.name).catch(err => console.error('Failed to send welcome email:', err));
    
    // Return full user object so frontend can display it
    return res.status(201).json({ 
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        skill: user.skill || '',
        bio: user.bio || '',
        price: user.price || 0,
        availability: user.availability || '',
        address: user.address || '',
        city: user.city || '',
        pincode: user.pincode || '',
        location: user.location || null
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me (requires Bearer token)
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub)
      .select('_id name email phone role avatarUrl bio skill price availability address city pincode location notificationPrefs gallery createdAt');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// PATCH /auth/me - update profile (requires Bearer token)
router.patch('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(token, JWT_SECRET);
    const allowed = ['name', 'phone', 'bio', 'avatarUrl', 'skill', 'price', 'availability', 'address', 'city', 'pincode', 'notificationPrefs'];
    const update = {};
    for (const k of allowed) {
      if (typeof req.body?.[k] !== 'undefined') update[k] = req.body[k];
    }
    const user = await User.findByIdAndUpdate(payload.sub, update, { new: true }).select('_id name email phone role avatarUrl bio skill price availability address city pincode');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;



