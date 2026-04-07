const mongoose = require('mongoose');

const rewardTransactionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  points: { 
    type: Number, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('RewardTransaction', rewardTransactionSchema);