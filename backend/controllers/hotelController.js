const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Feedback = require('../models/Feedback');
const { computeRoomAvailability, getBookedRoomCountMap, normalizeDateRange } = require('../utils/availability');

exports.getHotels = async (req, res) => {
  try {
    const { city, location, min_price, max_price, check_in, check_out } = req.query;
    const keyword = String(location || city || '').trim();
    const minPriceFilter = Number(min_price || 0);
    const maxPriceFilter = Number(max_price || 0);
    const dateRange = normalizeDateRange(check_in, check_out);

    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngay nhan/tra phong khong hop le' });
    }

    const filter = {};
    if (keyword) {
      filter.$or = [
        { city: { $regex: keyword, $options: 'i' } },
        { address: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } },
      ];
    }

    const hotels = await Hotel.find(filter).lean();
    const hotelIds = hotels.map((hotel) => hotel._id);
    const rooms = await Room.find({ hotel_id: { $in: hotelIds } }).lean();
    const feedbacks = await Feedback.find({ hotel_id: { $in: hotelIds } }).lean();
    const bookedMap = dateRange.hasRange && dateRange.isValid
      ? await getBookedRoomCountMap({
          roomIds: rooms.map((room) => room._id),
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
        })
      : new Map();

    const roomsByHotel = rooms.reduce((acc, room) => {
      const key = String(room.hotel_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(computeRoomAvailability(room, bookedMap.get(String(room._id)) || 0));
      return acc;
    }, {});

    const feedbacksByHotel = feedbacks.reduce((acc, feedback) => {
      const key = String(feedback.hotel_id);
      if (!acc[key]) acc[key] = [];
      acc[key].push(feedback);
      return acc;
    }, {});

    const result = hotels.map((hotel) => {
      const hotelRooms = roomsByHotel[String(hotel._id)] || [];
      const bookableRooms = hotelRooms.filter((room) => room.is_bookable);
      const priceSource = bookableRooms.length > 0 ? bookableRooms : hotelRooms;
      const minPrice = priceSource.length > 0
        ? Math.min(...priceSource.map((room) => Number(room.price_per_night || 0)))
        : null;
      const availableRoomCount = hotelRooms.reduce((sum, room) => sum + Number(room.available_quantity || 0), 0);
      const totalRoomCount = hotelRooms.reduce((sum, room) => sum + Number(room.total_quantity || 0), 0);
      const hotelFeedbacks = feedbacksByHotel[String(hotel._id)] || [];
      const averageRating = hotelFeedbacks.length > 0
        ? hotelFeedbacks.reduce((sum, item) => sum + Number(item.rating || 0), 0) / hotelFeedbacks.length
        : null;

      if (minPriceFilter && (minPrice === null || minPrice < minPriceFilter)) return null;
      if (maxPriceFilter && (minPrice === null || minPrice > maxPriceFilter)) return null;
      if (dateRange.hasRange && availableRoomCount <= 0) return null;

      return {
        ...hotel,
        min_price: minPrice,
        available_room_count: availableRoomCount,
        total_room_count: totalRoomCount,
        room_types_count: hotelRooms.length,
        average_rating: averageRating,
        review_count: hotelFeedbacks.length,
        search_meta: {
          check_in: check_in || '',
          check_out: check_out || '',
        },
      };
    }).filter(Boolean);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.getHotelById = async (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    const dateRange = normalizeDateRange(check_in, check_out);
    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngay nhan/tra phong khong hop le' });
    }

    const hotel = await Hotel.findById(req.params.id).lean();
    if (!hotel) return res.status(404).json({ message: 'Khong tim thay khach san' });

    const rooms = await Room.find({ hotel_id: req.params.id }).lean();
    const feedbacks = await Feedback.find({ hotel_id: req.params.id })
      .populate('user_id', 'full_name')
      .lean();

    const bookedMap = dateRange.hasRange && dateRange.isValid
      ? await getBookedRoomCountMap({
          roomIds: rooms.map((room) => room._id),
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
        })
      : new Map();

    const roomsWithAvailability = rooms.map((room) => (
      computeRoomAvailability(room, bookedMap.get(String(room._id)) || 0)
    ));

    const reviewCount = feedbacks.length;
    const averageRating = reviewCount > 0
      ? feedbacks.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviewCount
      : null;

    res.json({
      ...hotel,
      rooms: roomsWithAvailability,
      feedbacks,
      average_rating: averageRating,
      review_count: reviewCount,
      min_price: roomsWithAvailability.length > 0
        ? Math.min(...roomsWithAvailability.map((room) => Number(room.price_per_night || 0)))
        : null,
      available_room_count: roomsWithAvailability.reduce((sum, room) => sum + Number(room.available_quantity || 0), 0),
      total_room_count: roomsWithAvailability.reduce((sum, room) => sum + Number(room.total_quantity || 0), 0),
      search_meta: {
        check_in: check_in || '',
        check_out: check_out || '',
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.createHotel = async (req, res) => {
  try {
    const hotel = await Hotel.create(req.body);
    res.status(201).json({ message: 'Tao khach san thanh cong', hotel });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.updateHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Cap nhat thanh cong', hotel });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.deleteHotel = async (req, res) => {
  try {
    await Hotel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Xoa thanh cong' });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};
