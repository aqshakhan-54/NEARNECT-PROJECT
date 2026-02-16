const express = require('express');
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const Message = require('../models/Message');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /admin/stats - Get platform statistics
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalWorkers,
      totalCustomers,
      totalBookings,
      completedBookings,
      pendingBookings,
      totalPayments,
      totalRevenue,
      totalReviews,
      avgRating
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'worker' }),
      User.countDocuments({ role: 'customer' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'pending' }),
      Payment.countDocuments({ status: 'success' }),
      Payment.aggregate([
        { $match: { status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Review.countDocuments({ status: 'active' }),
      Review.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, avg: { $avg: '$rating' } } }
      ])
    ]);

    const revenue = totalRevenue[0]?.total || 0;
    const averageRating = avgRating[0]?.avg || 0;

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      recentUsers,
      recentBookings,
      recentPayments
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Payment.countDocuments({ createdAt: { $gte: sevenDaysAgo }, status: 'success' })
    ]);

    res.json({
      overview: {
        totalUsers,
        totalWorkers,
        totalCustomers,
        totalBookings,
        completedBookings,
        pendingBookings,
        totalPayments,
        totalRevenue: revenue,
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10
      },
      recentActivity: {
        newUsers: recentUsers,
        newBookings: recentBookings,
        newPayments: recentPayments
      },
      bookings: {
        pending: pendingBookings,
        confirmed: await Booking.countDocuments({ status: 'confirmed' }),
        completed: completedBookings,
        cancelled: await Booking.countDocuments({ status: 'cancelled' })
      }
    });
  } catch (err) {
    console.error('Get admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /admin/users - Get all users with filters
router.get('/users', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 50, sort = '-createdAt' } = req.query;

    let query = {};

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Search by name, email, or phone
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Parse sort
    let sortObj = {};
    if (sort.startsWith('-')) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /admin/users/:id - Get specific user details
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's bookings, reviews, payments
    const [bookings, reviews, payments] = await Promise.all([
      Booking.find({ $or: [{ customerId: user._id }, { workerId: user._id }] })
        .populate('customerId', 'name email')
        .populate('workerId', 'name email skill')
        .sort({ createdAt: -1 })
        .limit(10),
      Review.find({ $or: [{ customerId: user._id }, { workerId: user._id }] })
        .populate('customerId', 'name')
        .populate('workerId', 'name skill')
        .sort({ createdAt: -1 })
        .limit(10),
      Payment.find({ $or: [{ customerId: user._id }, { workerId: user._id }] })
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    res.json({
      user,
      bookings,
      reviews,
      payments
    });
  } catch (err) {
    console.error('Get admin user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /admin/users/:id - Update user (status, role, etc.)
router.patch('/users/:id', async (req, res) => {
  try {
    const { status, role, isVerified, isBlocked } = req.body;

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (role !== undefined) updateData.role = role;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Update admin user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /admin/users/:id - Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deleting yourself
    if (userId === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete admin user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /admin/bookings - Get all bookings with filters
router.get('/bookings', async (req, res) => {
  try {
    const { status, workerId, customerId, page = 1, limit = 50, sort = '-createdAt' } = req.query;

    let query = {};

    if (status) query.status = status;
    if (workerId) query.workerId = workerId;
    if (customerId) query.customerId = customerId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Parse sort
    let sortObj = {};
    if (sort.startsWith('-')) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('customerId', 'name email phone')
        .populate('workerId', 'name email skill')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query)
    ]);

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get admin bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// PATCH /admin/bookings/:id - Update booking (admin override)
router.patch('/bookings/:id', async (req, res) => {
  try {
    const { status, amount, scheduledFor } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (amount !== undefined) updateData.amount = amount;
    if (scheduledFor) updateData.scheduledFor = new Date(scheduledFor);

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('customerId', 'name email phone')
      .populate('workerId', 'name email skill');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(booking);
  } catch (err) {
    console.error('Update admin booking error:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

module.exports = router;

