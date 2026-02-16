const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    type: { 
      type: String, 
      enum: ['booking', 'message', 'payment', 'system', 'review'],
      required: true,
      index: true 
    },
    title: { 
      type: String, 
      required: true,
      trim: true 
    },
    message: { 
      type: String, 
      required: true,
      trim: true 
    },
    read: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    urgent: { 
      type: Boolean, 
      default: false 
    },
    icon: { 
      type: String, 
      default: 'fas fa-bell' 
    },
    iconColor: { 
      type: String, 
      default: '#6c5ce7' 
    },
    relatedId: { 
      type: mongoose.Schema.Types.ObjectId,
      default: null 
    },
    relatedType: { 
      type: String,
      enum: ['booking', 'message', 'payment', 'review', null],
      default: null 
    },
    actionUrl: { 
      type: String, 
      default: '' 
    }
  },
  { timestamps: true }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

