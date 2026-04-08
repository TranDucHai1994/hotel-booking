const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  check_in: { type: Date, required: true },
  check_out: { type: Date, required: true },
  guests: { type: Number, default: 1 },
  total_amount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  payment_method: { type: String, enum: ['mock_card', 'mock_momo', 'pay_at_hotel'], default: 'pay_at_hotel' },
  payment_status: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
  customer_note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);