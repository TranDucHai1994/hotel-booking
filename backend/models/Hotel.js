const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { type: String, default: '' },
  address: { type: String, default: '' },
  description: { type: String, default: '' },
  property_type: {
    type: String,
    enum: ['hotel', 'resort', 'homestay', 'apartment', 'villa', 'hostel', 'boutique', 'motel'],
    default: 'hotel',
  },
  star_rating: { type: Number, min: 0, max: 5, default: 0 },
  is_hot_deal: { type: Boolean, default: false },
  hot_deal_discount_percent: { type: Number, min: 0, max: 100, default: 0 },
  amenities: [String],
  cover_image: { type: String, default: '' },
  images: [String],
}, { timestamps: true });

module.exports = mongoose.model('Hotel', hotelSchema);