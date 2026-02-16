const express = require('express');
const { authenticate } = require('../middleware/auth');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNewMessageEmail } = require('../services/emailService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /messages - Get all conversations for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;

    // Get all unique conversation IDs where user is sender or recipient
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId },
            { recipientId: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipientId', userId] },
                    { $eq: ['$read', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    // Populate user details for each conversation
    const conversationsWithUsers = await Promise.all(
      conversations.map(async (conv) => {
        const lastMsg = conv.lastMessage;
        const otherUserId = lastMsg.senderId.toString() === userId.toString() 
          ? lastMsg.recipientId 
          : lastMsg.senderId;

        const otherUser = await User.findById(otherUserId)
          .select('name email phone avatarUrl role skill');

        return {
          conversationId: conv._id,
          otherUser,
          lastMessage: {
            content: lastMsg.content,
            createdAt: lastMsg.createdAt,
            senderId: lastMsg.senderId,
            read: lastMsg.read
          },
          unreadCount: conv.unreadCount
        };
      })
    );

    res.json(conversationsWithUsers);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /messages/:conversationId - Get all messages in a conversation
router.get('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    // Verify user is part of this conversation
    const message = await Message.findOne({ conversationId });
    if (!message) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (message.senderId.toString() !== userId.toString() && 
        message.recipientId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all messages in conversation
    const messages = await Message.find({ conversationId })
      .populate('senderId', 'name email avatarUrl')
      .populate('recipientId', 'name email avatarUrl')
      .sort({ createdAt: 1 });

    // Mark messages as read if current user is recipient
    await Message.updateMany(
      {
        conversationId,
        recipientId: userId,
        read: false
      },
      {
        $set: { read: true, readAt: new Date() }
      }
    );

    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /messages - Send a new message
router.post('/', async (req, res) => {
  try {
    const { recipientId, content } = req.body;

    if (!recipientId || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: recipientId, content' 
      });
    }

    // Validate recipient exists
    const recipient = await User.findById(recipientId).select('name email avatarUrl');
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Don't allow sending message to self
    if (recipientId === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot send message to yourself' });
    }

    // Get sender info
    const sender = await User.findById(req.userId).select('name email avatarUrl');
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    // Generate conversation ID
    const conversationId = Message.getConversationId(req.userId, recipientId);

    // Create message
    const message = await Message.create({
      senderId: req.userId,
      recipientId,
      content: content.trim(),
      conversationId,
      read: false
    });

    // Populate sender and recipient
    await message.populate('senderId', 'name email avatarUrl');
    await message.populate('recipientId', 'name email avatarUrl');

    // Create notification for recipient
    await Notification.create({
      userId: recipientId,
      type: 'message',
      title: 'New Message',
      message: `You have a new message from ${sender.name}`,
      urgent: false,
      icon: 'fas fa-comments',
      iconColor: '#6c5ce7',
      relatedId: message._id,
      relatedType: 'message',
      actionUrl: `/chat.html?conversation=${conversationId}`
    });

    // Send email notification to recipient
    if (recipient.email) {
      const messagePreview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      sendNewMessageEmail(recipient.email, sender.name, messagePreview)
        .catch(err => console.error('Failed to send message email:', err));
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PATCH /messages/:id/read - Mark message as read
router.patch('/:id/read', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the recipient
    if (message.recipientId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    message.read = true;
    message.readAt = new Date();
    await message.save();

    res.json(message);
  } catch (err) {
    console.error('Mark message read error:', err);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// GET /messages/user/:userId - Get or create conversation with specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    // Validate user exists
    const otherUser = await User.findById(userId).select('name email avatarUrl role skill');
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate conversation ID
    const conversationId = Message.getConversationId(currentUserId, userId);

    // Get messages in this conversation
    const messages = await Message.find({ conversationId })
      .populate('senderId', 'name email avatarUrl')
      .populate('recipientId', 'name email avatarUrl')
      .sort({ createdAt: 1 });

    // Get unread count
    const unreadCount = await Message.countDocuments({
      conversationId,
      recipientId: currentUserId,
      read: false
    });

    res.json({
      conversationId,
      otherUser,
      messages,
      unreadCount
    });
  } catch (err) {
    console.error('Get user conversation error:', err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// DELETE /messages/:id - Delete message (soft delete - only for sender)
router.delete('/:id', async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Only sender can delete
    if (message.senderId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only sender can delete message' });
    }

    await Message.findByIdAndDelete(req.params.id);

    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;

