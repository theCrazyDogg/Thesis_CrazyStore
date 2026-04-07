const mongoose = require('mongoose');

const popupNotificationSchema = new mongoose.Schema({
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product' 
  }, 
  message: { 
    type: String, 
    required: true 
  },
  image_url: String,
  is_active: { 
    type: Boolean, 
    default: true 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('PopupNotification', popupNotificationSchema);