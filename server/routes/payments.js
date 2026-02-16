const express = require('express');
const { authenticate } = require('../middleware/auth');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPaymentConfirmationEmail } = require('../services/emailService');
const razorpay = require('razorpay');

const router = express.Router();

// Initialize Razorpay (use environment variables in production)
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('⚠️  Razorpay keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not set. Payments will not work without them.');
}

// All routes require authentication
router.use(authenticate);

// POST /payments/create-order - Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { bookingId, amount, currency = 'INR' } = req.body;

    if (!bookingId || !amount) {
      return res.status(400).json({ error: 'Missing required fields: bookingId, amount' });
    }

    // Verify booking exists and belongs to user
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ bookingId });
    if (existingPayment && existingPayment.status === 'completed') {
      return res.status(400).json({ error: 'Payment already completed for this booking' });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: `booking_${bookingId}_${Date.now()}`,
      notes: {
        bookingId: bookingId.toString(),
        customerId: req.userId.toString(),
        workerId: booking.workerId.toString()
      }
    };

    const order = await razorpayInstance.orders.create(options);

    // Create or update payment record
    let payment = await Payment.findOne({ bookingId });
    if (!payment) {
      payment = await Payment.create({
        bookingId,
        customerId: req.userId,
        workerId: booking.workerId,
        amount,
        currency,
        paymentMethod: req.body.paymentMethod || 'upi',
        status: 'pending',
        gateway: 'razorpay',
        gatewayOrderId: order.id
      });
    } else {
      payment.gatewayOrderId = order.id;
      payment.status = 'pending';
      payment.amount = amount;
      await payment.save();
    }

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: razorpayInstance.key_id,
      paymentId: payment._id
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /payments/verify - Verify payment after completion
router.post('/verify', async (req, res) => {
  try {
    const { orderId, paymentId, signature, bookingId } = req.body;

    if (!orderId || !paymentId || !signature || !bookingId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify payment signature
    const crypto = require('crypto');
    const generatedSignature = crypto
      .createHmac('sha256', razorpayInstance.key_secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (generatedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update payment record
    const payment = await Payment.findOne({ bookingId });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    payment.status = 'completed';
    payment.gatewayPaymentId = paymentId;
    payment.gatewayTransactionId = paymentId;
    payment.paidAt = new Date();
    await payment.save();

    // Update booking status
    const booking = await Booking.findById(bookingId);
    if (booking) {
      booking.status = 'confirmed';
      booking.paymentStatus = 'paid';
      booking.paymentId = payment._id;
      await booking.save();

      // Populate customer for email
      await booking.populate('customerId', 'email name');

      // Create notifications
      await Notification.create({
        userId: booking.customerId._id,
        type: 'payment',
        title: 'Payment Successful',
        message: `Your payment of ₹${payment.amount} has been confirmed`,
        urgent: false,
        icon: 'fas fa-check-circle',
        iconColor: '#00b894',
        relatedId: booking._id,
        relatedType: 'payment'
      });

      await Notification.create({
        userId: booking.workerId,
        type: 'booking',
        title: 'New Booking Confirmed',
        message: `You have a confirmed booking for ${booking.service}`,
        urgent: true,
        icon: 'fas fa-calendar-check',
        iconColor: '#00b894',
        relatedId: booking._id,
        relatedType: 'booking'
      });

      // Send payment confirmation email
      if (booking.customerId && booking.customerId.email) {
        sendPaymentConfirmationEmail(booking.customerId.email, {
          amount: payment.amount,
          gatewayTransactionId: payment.gatewayTransactionId,
          paidAt: payment.paidAt
        }).catch(err => console.error('Failed to send payment email:', err));
      }
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        id: payment._id,
        status: payment.status,
        amount: payment.amount
      }
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// POST /payments/failed - Handle failed payment
router.post('/failed', async (req, res) => {
  try {
    const { orderId, paymentId, error, bookingId } = req.body;

    const payment = await Payment.findOne({ bookingId });
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    payment.status = 'failed';
    payment.gatewayPaymentId = paymentId || '';
    payment.failedAt = new Date();
    payment.failureReason = error?.description || 'Payment failed';
    await payment.save();

    // Create notification
    await Notification.create({
      userId: req.userId,
      type: 'payment',
      title: 'Payment Failed',
      message: `Your payment of ₹${payment.amount} failed. Please try again.`,
      urgent: true,
      icon: 'fas fa-exclamation-circle',
      iconColor: '#e17055',
      relatedId: payment._id,
      relatedType: 'payment'
    });

    res.json({ success: true, message: 'Payment failure recorded' });
  } catch (err) {
    console.error('Payment failed error:', err);
    res.status(500).json({ error: 'Failed to record payment failure' });
  }
});

// GET /payments/:id - Get payment details
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('bookingId')
      .populate('customerId', 'name email')
      .populate('workerId', 'name email');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check access
    if (payment.customerId._id.toString() !== req.userId.toString() && 
        payment.workerId._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(payment);
  } catch (err) {
    console.error('Get payment error:', err);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// GET /payments/booking/:bookingId - Get payment for booking
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const payment = await Payment.findOne({ bookingId: req.params.bookingId })
      .populate('bookingId')
      .populate('customerId', 'name email')
      .populate('workerId', 'name email');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for this booking' });
    }

    // Check access
    if (payment.customerId._id.toString() !== req.userId.toString() && 
        payment.workerId._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(payment);
  } catch (err) {
    console.error('Get payment by booking error:', err);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

module.exports = router;

