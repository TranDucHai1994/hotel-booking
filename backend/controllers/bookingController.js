const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { logAudit } = require('../services/auditService');

exports.createBooking = async (req, res) => {
  const { hotel_id, room_id, check_in, check_out, guests, payment_method, customer_note } = req.body;
  try {
    const room = await Room.findById(room_id);
    if (!room) return res.status(404).json({ message: 'Phòng không tồn tại' });
    const nights = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24));
    if (nights <= 0) return res.status(400).json({ message: 'Ngày không hợp lệ' });
    const total_amount = room.price_per_night * nights;
    const booking = await Booking.create({
      user_id: req.user.id, hotel_id, room_id,
      check_in, check_out, guests, total_amount,
      payment_method, customer_note
    });
    await logAudit({ userId: req.user.id, action: 'create', entity: 'booking', entityId: booking._id });
    res.status(201).json({ message: 'Đặt phòng thành công', booking });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user_id: req.user.id })
      .populate('hotel_id', 'name city cover_image')
      .populate('room_id', 'room_type price_per_night')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user_id', 'full_name email')
      .populate('hotel_id', 'name city')
      .populate('room_id', 'room_type price_per_night')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id, { status: req.body.status }, { new: true }
    );
    if (booking) await logAudit({ userId: req.user.id, action: 'update_status', entity: 'booking', entityId: booking._id });
    res.json({ message: 'Cập nhật trạng thái thành công', booking });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user_id: req.user.id
    });
    if (!booking) return res.status(404).json({ message: 'Không tìm thấy booking' });
    if (booking.status !== 'pending')
      return res.status(400).json({ message: 'Chỉ có thể hủy booking đang chờ xác nhận' });
    booking.status = 'cancelled';
    await booking.save();
    await logAudit({ userId: req.user.id, action: 'cancel', entity: 'booking', entityId: booking._id });
    res.json({ message: 'Hủy đặt phòng thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};