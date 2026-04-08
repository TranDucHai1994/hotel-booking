const Room = require('../models/Room');

exports.getRoomsByHotel = async (req, res) => {
  try {
    const rooms = await Room.find({ hotel_id: req.query.hotel_id });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({ message: 'Tạo phòng thành công', room });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Cập nhật thành công', room });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};