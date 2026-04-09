const Room = require('../models/Room');
const { computeRoomAvailability, getBookedRoomCountMap, normalizeDateRange } = require('../utils/availability');

exports.getRoomsByHotel = async (req, res) => {
  try {
    const { hotel_id, check_in, check_out } = req.query;
    const dateRange = normalizeDateRange(check_in, check_out);
    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngay nhan/tra phong khong hop le' });
    }

    const rooms = await Room.find({ hotel_id }).lean();
    const bookedMap = dateRange.hasRange && dateRange.isValid
      ? await getBookedRoomCountMap({
          roomIds: rooms.map((room) => room._id),
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
        })
      : new Map();

    res.json(rooms.map((room) => (
      computeRoomAvailability(room, bookedMap.get(String(room._id)) || 0)
    )));
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({ message: 'Tao phong thanh cong', room });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Cap nhat thanh cong', room });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: 'Xoa thanh cong' });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};
