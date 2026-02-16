const express = require('express');
const { authenticate } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /notifications - Get all notifications for current user
router.get('/', async (req, res) => {
  try {
    const { type, read, limit = 50 } = req.query;
    const userId = req.userId;

    let query = { userId };

    // Filter by type if provided
    if (type) {
      query.type = type;
    }

    // Filter by read status if provided
    if (read !== undefined) {
      query.read = read === 'true';
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /notifications - Create a new notification
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      urgent,
      icon,
      iconColor,
      relatedId,
      relatedType,
      actionUrl
    } = req.body;

    // Validate required fields
    if (!userId || !type || !title || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, type, title, message' 
      });
    }

    // Validate type
    const validTypes = ['booking', 'message', 'payment', 'system', 'review'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    // Check if user has permission to create notification for this user
    // (In production, you might want to restrict this to system/admin only)
    const notification = await Notification.create({
      userId,
      type,
      title: title.trim(),
      message: message.trim(),
      urgent: urgent || false,
      icon: icon || 'fas fa-bell',
      iconColor: iconColor || '#6c5ce7',
      relatedId: relatedId || null,
      relatedType: relatedType || null,
      actionUrl: actionUrl || '',
      read: false
    });

    res.status(201).json(notification);
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// GET /notifications/:id - Get specific notification
router.get('/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if user owns this notification
    if (notification.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(notification);
  } catch (err) {
    console.error('Get notification error:', err);
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

// PATCH /notifications/:id/read - Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if user owns this notification
    if (notification.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// POST /notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const userId = req.userId;

    const result = await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );

    res.json({ 
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount 
    });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// DELETE /notifications/:id - Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if user owns this notification
    if (notification.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.json({ message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// GET /notifications/stats - Get notification statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.userId;

    const stats = await Notification.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] }
          },
          urgent: {
            $sum: { $cond: [{ $eq: ['$urgent', true] }, 1, 0] }
          },
          byType: {
            $push: {
              type: '$type',
              read: '$read'
            }
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        total: 0,
        unread: 0,
        urgent: 0,
        byType: {}
      });
    }

    // Count by type
    const byType = {};
    stats[0].byType.forEach(item => {
      if (!byType[item.type]) {
        byType[item.type] = { total: 0, unread: 0 };
      }
      byType[item.type].total++;
      if (!item.read) {
        byType[item.type].unread++;
      }
    });

    res.json({
      total: stats[0].total,
      unread: stats[0].unread,
      urgent: stats[0].urgent,
      byType
    });
  } catch (err) {
    console.error('Get notification stats error:', err);
    res.status(500).json({ error: 'Failed to fetch notification statistics' });
  }
});

module.exports = router;

