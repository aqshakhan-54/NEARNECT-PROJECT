const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    bookingId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Booking', 
      required: true,
      unique: true,
      index: true 
    },
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
    amount: { 
      type: Number, 
      required: true,
      min: 0 
    },
    currency: { 
      type: String, 
      default: 'INR',
      uppercase: true 
    },
    paymentMethod: { 
      type: String, 
      enum: ['card', 'upi', 'netbanking', 'wallet', 'cash'],
      required: true 
    },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true 
    },
    // Payment gateway details
    gateway: { 
      type: String, 
      enum: ['razorpay', 'stripe', 'cash', 'other'],
      default: 'razorpay' 
    },
    gatewayTransactionId: { 
      type: String, 
      default: '',
      index: true 
    },
    gatewayOrderId: { 
      type: String, 
      default: '' 
    },
    gatewayPaymentId: { 
      type: String, 
      default: '' 
    },
    // Payment details
    paidAt: { 
      type: Date, 
      default: null 
    },
    failedAt: { 
      type: Date, 
      default: null 
    },
    failureReason: { 
      type: String, 
      default: '' 
    },
    // Refund details
    refundAmount: { 
      type: Number, 
      default: 0,
      min: 0 
    },
    refundedAt: { 
      type: Date, 
      default: null 
    },
    refundReason: { 
      type: String, 
      default: '' 
    },
    gatewayRefundId: { 
      type: String, 
      default: '' 
    },
    // Additional metadata
    metadata: { 
      type: mongoose.Schema.Types.Mixed,
      default: {} 
    }
  },
  { timestamps: true }
);

// Index for efficient queries
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ workerId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);

