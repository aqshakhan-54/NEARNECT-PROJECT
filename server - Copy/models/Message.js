const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    recipientId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    content: { 
      type: String, 
      required: true,
      trim: true 
    },
    read: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    readAt: { 
      type: Date, 
      default: null 
    },
    conversationId: { 
      type: String, 
      required: true,
      index: true 
    },
    // Optional: for file attachments in future
    attachments: [{
      url: String,
      type: String,
      name: String
    }]
  },
  { timestamps: true }
);

// Helper method to generate conversationId
messageSchema.statics.getConversationId = function(userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `${ids[0]}_${ids[1]}`;
};

// Index for efficient queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, recipientId: 1 });
messageSchema.index({ recipientId: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);

