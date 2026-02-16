const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
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
    bookingId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Booking',
      default: null 
    },
    rating: { 
      type: Number, 
      required: true,
      min: 1,
      max: 5,
      index: true 
    },
    comment: { 
      type: String, 
      default: '',
      trim: true 
    },
    // Optional: specific aspect ratings
    serviceQuality: { 
      type: Number, 
      min: 1,
      max: 5,
      default: null 
    },
    punctuality: { 
      type: Number, 
      min: 1,
      max: 5,
      default: null 
    },
    professionalism: { 
      type: Number, 
      min: 1,
      max: 5,
      default: null 
    },
    // Review status
    status: { 
      type: String, 
      enum: ['active', 'hidden', 'deleted'],
      default: 'active',
      index: true 
    },
    // Worker response to review
    workerResponse: { 
      type: String, 
      default: '',
      trim: true 
    },
    workerResponseAt: { 
      type: Date, 
      default: null 
    }
  },
  { timestamps: true }
);

// Ensure one review per booking
reviewSchema.index({ bookingId: 1 }, { unique: true, sparse: true });
// Ensure one review per customer-worker pair (optional, can be removed if multiple reviews allowed)
reviewSchema.index({ customerId: 1, workerId: 1 });
// Index for worker reviews
reviewSchema.index({ workerId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);

