const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  category: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true 
  },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  image_url: String,
  is_featured: { type: Boolean, default: false },
  currency: { type: String, default: 'USD' }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);