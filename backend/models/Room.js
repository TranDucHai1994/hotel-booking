const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  room_type: { type: String, default: 'Standard' },
  max_guests: { type: Number, default: 2 },
  price_per_night: { type: Number, required: true },
  total_quantity: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['available', 'maintenance', 'inactive'],
    default: 'available',
  },
  description: { type: String, default: '' },
  amenities: [String],
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
