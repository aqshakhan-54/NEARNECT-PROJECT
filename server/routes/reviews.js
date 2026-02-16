const express = require('express');
const { authenticate } = require('../middleware/auth');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const User = require('../models/User');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /reviews - Create a new review
router.post('/', async (req, res) => {
  try {
    const {
      workerId,
      bookingId,
      rating,
      comment,
      serviceQuality,
      punctuality,
      professionalism
    } = req.body;

    if (!workerId || !rating) {
      return res.status(400).json({ 
        error: 'Missing required fields: workerId, rating' 
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Validate worker exists and is actually a worker
    const worker = await User.findById(workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    if (worker.role !== 'worker') {
      return res.status(400).json({ error: 'User is not a worker' });
    }

    // Don't allow reviewing yourself
    if (workerId === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot review yourself' });
    }

    // If bookingId provided, verify booking exists and belongs to customer
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      if (booking.customerId.toString() !== req.userId.toString()) {
        return res.status(403).json({ error: 'Access denied to this booking' });
      }
      if (booking.workerId.toString() !== workerId) {
        return res.status(400).json({ error: 'Booking does not match worker' });
      }
      if (booking.status !== 'completed') {
        return res.status(400).json({ error: 'Can only review completed bookings' });
      }

      // Check if review already exists for this booking
      const existingReview = await Review.findOne({ bookingId });
      if (existingReview) {
        return res.status(409).json({ error: 'Review already exists for this booking' });
      }
    }

    // Check if customer already reviewed this worker (optional - can be removed if multiple reviews allowed)
    const existingWorkerReview = await Review.findOne({
      customerId: req.userId,
      workerId,
      status: 'active'
    });
    if (existingWorkerReview && !bookingId) {
      return res.status(409).json({ 
        error: 'You have already reviewed this worker. Update your existing review instead.' 
      });
    }

    // Create review
    const review = await Review.create({
      customerId: req.userId,
      workerId,
      bookingId: bookingId || null,
      rating,
      comment: comment?.trim() || '',
      serviceQuality: serviceQuality || null,
      punctuality: punctuality || null,
      professionalism: professionalism || null,
      status: 'active'
    });

    // Populate user details
    await review.populate('customerId', 'name email avatarUrl');
    await review.populate('workerId', 'name email avatarUrl skill');

    // Create notification for worker
    const customer = await User.findById(req.userId).select('name');
    await Notification.create({
      userId: workerId,
      type: 'review',
      title: 'New Review',
      message: `You received a ${rating}-star review from ${customer.name}`,
      urgent: false,
      icon: 'fas fa-star',
      iconColor: '#fdcb6e',
      relatedId: review._id,
      relatedType: 'review',
      actionUrl: `/worker-dashboard.html#reviews`
    });

    res.status(201).json(review);
  } catch (err) {
    console.error('Create review error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Review already exists for this booking' });
    }
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// GET /reviews - Get reviews (filtered by workerId or customerId)
router.get('/', async (req, res) => {
  try {
    const { workerId, customerId, bookingId, status = 'active' } = req.query;

    let query = { status };

    // Filter by worker
    if (workerId) {
      query.workerId = workerId;
    }

    // Filter by customer
    if (customerId) {
      query.customerId = customerId;
    }

    // Filter by booking
    if (bookingId) {
      query.bookingId = bookingId;
    }

    // If no filters, return reviews for current user
    if (!workerId && !customerId && !bookingId) {
      if (req.user.role === 'worker') {
        query.workerId = req.userId;
      } else {
        query.customerId = req.userId;
      }
    }

    const reviews = await Review.find(query)
      .populate('customerId', 'name email avatarUrl')
      .populate('workerId', 'name email avatarUrl skill')
      .populate('bookingId', 'service scheduledFor')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(reviews);
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET /reviews/:id - Get specific review
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('customerId', 'name email avatarUrl')
      .populate('workerId', 'name email avatarUrl skill')
      .populate('bookingId', 'service scheduledFor');

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json(review);
  } catch (err) {
    console.error('Get review error:', err);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// GET /reviews/worker/:workerId - Get all reviews for a worker
router.get('/worker/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    const { status = 'active' } = req.query;

    const reviews = await Review.find({ workerId, status })
      .populate('customerId', 'name email avatarUrl')
      .populate('bookingId', 'service scheduledFor')
      .sort({ createdAt: -1 });

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Count by rating
    const ratingCounts = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length
    };

    res.json({
      reviews,
      stats: {
        total: reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
        ratingCounts
      }
    });
  } catch (err) {
    console.error('Get worker reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch worker reviews' });
  }
});

// PATCH /reviews/:id - Update review (only by customer who created it)
router.patch('/:id', async (req, res) => {
  try {
    const { rating, comment, serviceQuality, punctuality, professionalism } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Only customer who created review can update
    if (review.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only review author can update' });
    }

    // Update fields
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment.trim();
    }

    if (serviceQuality !== undefined) {
      review.serviceQuality = serviceQuality;
    }

    if (punctuality !== undefined) {
      review.punctuality = punctuality;
    }

    if (professionalism !== undefined) {
      review.professionalism = professionalism;
    }

    await review.save();

    await review.populate('customerId', 'name email avatarUrl');
    await review.populate('workerId', 'name email avatarUrl skill');

    res.json(review);
  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// POST /reviews/:id/response - Add worker response to review
router.post('/:id/response', async (req, res) => {
  try {
    const { response } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Only worker can respond
    if (review.workerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only worker can respond to review' });
    }

    review.workerResponse = response?.trim() || '';
    review.workerResponseAt = new Date();
    await review.save();

    await review.populate('customerId', 'name email avatarUrl');
    await review.populate('workerId', 'name email avatarUrl skill');

    res.json(review);
  } catch (err) {
    console.error('Add review response error:', err);
    res.status(500).json({ error: 'Failed to add response' });
  }
});

// DELETE /reviews/:id - Delete review (soft delete - only by customer)
router.delete('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Only customer who created review can delete
    if (review.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only review author can delete' });
    }

    // Soft delete
    review.status = 'deleted';
    await review.save();

    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;

