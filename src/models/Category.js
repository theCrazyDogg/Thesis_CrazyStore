const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  cover_image: String
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);