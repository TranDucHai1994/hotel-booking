const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
  rating: { type: Number, min: 1, max: 5, required: true },
  content: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);