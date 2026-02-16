const express = require('express');
const { authenticate } = require('../middleware/auth');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { sendBookingConfirmationEmail } = require('../services/emailService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /bookings - Create a new booking
router.post('/', async (req, res) => {
  try {
    const {
      providerId,
      workerId,
      service,
      scheduledFor,
      address,
      instructions,
      customerName,
      customerPhone,
      customerEmail,
      amount,
      estimatedDuration
    } = req.body;

    // Use providerId or workerId (both refer to the same thing)
    const actualWorkerId = providerId || workerId;

    if (!actualWorkerId || !service || !scheduledFor || !address) {
      return res.status(400).json({ 
        error: 'Missing required fields: workerId, service, scheduledFor, address' 
      });
    }

    // Validate scheduled date is in future
    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate < new Date()) {
      return res.status(400).json({ error: 'Scheduled date must be in the future' });
    }

    // Create booking
    const booking = await Booking.create({
      customerId: req.userId,
      workerId: actualWorkerId,
      service: service.trim(),
      scheduledFor: scheduledDate,
      address: address.trim(),
      instructions: instructions?.trim() || '',
      customerName: customerName || req.user.name,
      customerPhone: customerPhone || req.user.phone,
      customerEmail: customerEmail || req.user.email,
      amount: amount || 0,
      estimatedDuration: estimatedDuration || '',
      status: 'pending'
    });

    // Create notification for worker
    await Notification.create({
      userId: actualWorkerId,
      type: 'booking',
      title: 'New Booking Request',
      message: `You have a new booking request for ${service} from ${req.user.name}`,
      urgent: true,
      icon: 'fas fa-calendar-check',
      iconColor: '#00b894',
      relatedId: booking._id,
      relatedType: 'booking',
      actionUrl: `/worker-dashboard.html#bookings`
    });

    // Populate worker and customer details
    await booking.populate('workerId', 'name email phone skill');
    await booking.populate('customerId', 'name email phone');

    // Send email to customer (async, don't wait)
    sendBookingConfirmationEmail(booking.customerEmail, {
      service: booking.service,
      scheduledFor: booking.scheduledFor,
      address: booking.address,
      amount: booking.amount
    }).catch(err => console.error('Failed to send booking email:', err));

    res.status(201).json(booking);
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// GET /bookings - Get all bookings for current user
router.get('/', async (req, res) => {
  try {
    const { status, role } = req.query;
    const userId = req.userId;

    let query = {};
    
    // If user is customer, get their bookings
    // If user is worker, get bookings assigned to them
    if (req.user.role === 'customer') {
      query.customerId = userId;
    } else if (req.user.role === 'worker') {
      query.workerId = userId;
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('customerId', 'name email phone avatarUrl')
      .populate('workerId', 'name email phone skill avatarUrl')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(bookings);
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /bookings/:id - Get specific booking
router.get('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customerId', 'name email phone avatarUrl')
      .populate('workerId', 'name email phone skill avatarUrl bio price');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user has access to this booking
    if (booking.customerId._id.toString() !== req.userId.toString() && 
        booking.workerId._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(booking);
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// PATCH /bookings/:id - Update booking status
router.patch('/:id', async (req, res) => {
  try {
    const { status, cancellationReason } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if user has permission to update
    const isCustomer = booking.customerId.toString() === req.userId.toString();
    const isWorker = booking.workerId.toString() === req.userId.toString();

    if (!isCustomer && !isWorker) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update status
    if (status) {
      const allowedStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      booking.status = status;

      // Set timestamps based on status
      if (status === 'completed') {
        booking.completedAt = new Date();
      } else if (status === 'cancelled') {
        booking.cancelledAt = new Date();
        booking.cancellationReason = cancellationReason || '';
      }

      await booking.save();

      // Create notifications
      const notifyUserId = isCustomer ? booking.workerId : booking.customerId;
      const notifyUserName = isCustomer ? 'Customer' : 'Worker';

      await Notification.create({
        userId: notifyUserId,
        type: 'booking',
        title: `Booking ${status}`,
        message: `Your booking has been ${status} by ${notifyUserName}`,
        urgent: status === 'cancelled',
        icon: status === 'completed' ? 'fas fa-check-circle' : 'fas fa-calendar-times',
        iconColor: status === 'completed' ? '#00b894' : '#e17055',
        relatedId: booking._id,
        relatedType: 'booking'
      });

      // Send email when booking is confirmed
      if (status === 'confirmed') {
        await booking.populate('customerId', 'email name');
        if (booking.customerId && booking.customerId.email) {
          sendBookingConfirmationEmail(booking.customerId.email, {
            service: booking.service,
            scheduledFor: booking.scheduledFor,
            address: booking.address,
            amount: booking.amount
          }).catch(err => console.error('Failed to send confirmation email:', err));
        }
      }
    }

    await booking.populate('customerId', 'name email phone');
    await booking.populate('workerId', 'name email phone skill');

    res.json(booking);
  } catch (err) {
    console.error('Update booking error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// DELETE /bookings/:id - Cancel/Delete booking
router.delete('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only customer can delete/cancel
    if (booking.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only customer can cancel booking' });
    }

    // Update status to cancelled instead of deleting
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = req.body.reason || 'Cancelled by customer';
    await booking.save();

    // Notify worker
    await Notification.create({
      userId: booking.workerId,
      type: 'booking',
      title: 'Booking Cancelled',
      message: `Booking for ${booking.service} has been cancelled by ${req.user.name}`,
      urgent: true,
      icon: 'fas fa-calendar-times',
      iconColor: '#e17055',
      relatedId: booking._id,
      relatedType: 'booking'
    });

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// GET /bookings/worker/:workerId - Get bookings for specific worker (admin or worker themselves)
router.get('/worker/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    const { status } = req.query;

    // Check if user is the worker or admin
    if (req.userId.toString() !== workerId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = { workerId };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('customerId', 'name email phone avatarUrl')
      .populate('workerId', 'name email phone skill')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error('Get worker bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

module.exports = router;

