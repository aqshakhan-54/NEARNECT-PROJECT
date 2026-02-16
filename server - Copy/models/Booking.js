const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    customerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    workerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    service: { 
      type: String, 
      required: true,
      trim: true 
    },
    scheduledFor: { 
      type: Date, 
      required: true,
      index: true 
    },
    address: { 
      type: String, 
      required: true,
      trim: true 
    },
    instructions: { 
      type: String, 
      default: '',
      trim: true 
    },
    customerName: { 
      type: String, 
      required: true,
      trim: true 
    },
    customerPhone: { 
      type: String, 
      required: true 
    },
    customerEmail: { 
      type: String, 
      required: true,
      lowercase: true 
    },
    amount: { 
      type: Number, 
      required: true,
      min: 0 
    },
    status: { 
      type: String, 
      enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true 
    },
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending',
      index: true 
    },
    paymentId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Payment',
      default: null 
    },
    estimatedDuration: { 
      type: String, 
      default: '' 
    },
    completedAt: { 
      type: Date, 
      default: null 
    },
    cancelledAt: { 
      type: Date, 
      default: null 
    },
    cancellationReason: { 
      type: String, 
      default: '' 
    }
  },
  { timestamps: true }
);

// Index for efficient queries
bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ workerId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, scheduledFor: 1 });

module.exports = mongoose.model('Booking', bookingSchema);

