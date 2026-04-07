const mongoose = require('mongoose');

const artSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  author: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['official', 'fanart'], 
    required: true 
  },
  image_url: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Art', artSchema);