const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  full_name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name: String,
      price: Number,
      quantity: Number,
      image_url: String
    }
  ],
  
  total_amount: Number,
  payment_method: { type: String, default: 'COD' },
  status: { 
    type: String, 
    default: 'Pending', 
    enum: ['Pending Payment', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] 
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);