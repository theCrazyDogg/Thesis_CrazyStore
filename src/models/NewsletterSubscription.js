const mongoose = require('mongoose');

const newsletterSubscriptionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true
  },
  status: {
    type: String,
    enum: ['Subscribed', 'Unsubscribed'],
    default: 'Subscribed'
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('NewsletterSubscription', newsletterSubscriptionSchema);