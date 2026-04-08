const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Feedback = require('../models/Feedback');

// Lấy tất cả khách sạn kèm giá thấp nhất
exports.getHotels = async (req, res) => {
  try {
    const { city, min_price, max_price } = req.query;
    let filter = {};
    if (city) filter.city = { $regex: city, $options: 'i' };

    const hotels = await Hotel.find(filter).lean();

    // Gắn min_price cho từng hotel
    const result = await Promise.all(hotels.map(async (hotel) => {
      const rooms = await Room.find({ hotel_id: hotel._id });
      const prices = rooms.map(r => r.price_per_night);
      const minPrice = prices.length > 0 ? Math.min(...prices) : null;

      // Lọc theo giá nếu có
      if (min_price && minPrice < Number(min_price)) return null;
      if (max_price && minPrice > Number(max_price)) return null;

      return { ...hotel, min_price: minPrice };
    }));

    res.json(result.filter(h => h !== null));
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy chi tiết khách sạn
exports.getHotelById = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id).lean();
    if (!hotel) return res.status(404).json({ message: 'Không tìm thấy khách sạn' });
    const rooms = await Room.find({ hotel_id: req.params.id });
    const feedbacks = await Feedback.find({ hotel_id: req.params.id })
      .populate('user_id', 'full_name');
    res.json({ ...hotel, rooms, feedbacks });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Tạo khách sạn (admin)
exports.createHotel = async (req, res) => {
  try {
    const hotel = await Hotel.create(req.body);
    res.status(201).json({ message: 'Tạo khách sạn thành công', hotel });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Cập nhật khách sạn (admin)
exports.updateHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Cập nhật thành công', hotel });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Xóa khách sạn (admin)
exports.deleteHotel = async (req, res) => {
  try {
    await Hotel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};