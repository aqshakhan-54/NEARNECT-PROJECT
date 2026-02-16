const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'worker', 'admin'], default: 'customer', index: true },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '' },
    skill: { type: String, default: '' },
    price: { type: Number, default: 0 },
    availability: { type: String, default: '' },
    // Location fields
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    pincode: { type: String, default: '' },
    notificationPrefs: {
      bookingUpdates: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true },
      newMessages: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);



