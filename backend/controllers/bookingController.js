const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { logAudit } = require('../services/auditService');
const { getBookedRoomCountMap, normalizeDateRange } = require('../utils/availability');

exports.createBooking = async (req, res) => {
  const { hotel_id, room_id, check_in, check_out, guests, payment_method, customer_note } = req.body;
  try {
    const room = await Room.findById(room_id);
    if (!room) return res.status(404).json({ message: 'Phong khong ton tai' });

    const dateRange = normalizeDateRange(check_in, check_out);
    if (!dateRange.hasRange || !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngay khong hop le' });
    }
    if ((room.status || 'available') !== 'available') {
      return res.status(400).json({ message: 'Phong hien khong san sang de dat' });
    }
    if (Number(guests || 0) > Number(room.max_guests || 0)) {
      return res.status(400).json({ message: 'So khach vuot qua suc chua phong' });
    }

    const bookedMap = await getBookedRoomCountMap({
      roomIds: [room._id],
      checkIn: dateRange.checkIn,
      checkOut: dateRange.checkOut,
    });
    const bookedCount = bookedMap.get(String(room._id)) || 0;
    const availableQuantity = Math.max(Number(room.total_quantity || 0) - bookedCount, 0);
    if (availableQuantity <= 0) {
      return res.status(400).json({ message: 'Phong da het cho trong khoang ngay ban chon' });
    }

    const nights = Math.ceil((dateRange.checkOut - dateRange.checkIn) / (1000 * 60 * 60 * 24));
    const total_amount = room.price_per_night * nights;
    const booking = await Booking.create({
      user_id: req.user.id,
      hotel_id,
      room_id,
      check_in,
      check_out,
      guests,
      total_amount,
      payment_method,
      payment_status: payment_method === 'mock_card' || payment_method === 'mock_momo' ? 'paid' : 'unpaid',
      customer_note,
    });
    await logAudit({ userId: req.user.id, action: 'create', entity: 'booking', entityId: booking._id });
    res.status(201).json({ message: 'Dat phong thanh cong', booking });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
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
    res.status(500).json({ message: 'Loi server', error: err.message });
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
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const update = { status: req.body.status };
    if (req.body.status === 'cancelled') {
      const current = await Booking.findById(req.params.id);
      if (current && current.payment_status === 'paid') {
        update.payment_status = 'refunded';
      }
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (booking) {
      await logAudit({ userId: req.user.id, action: 'update_status', entity: 'booking', entityId: booking._id });
    }
    res.json({ message: 'Cap nhat trang thai thanh cong', booking });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user_id: req.user.id,
    });
    if (!booking) return res.status(404).json({ message: 'Khong tim thay booking' });
    if (booking.status === 'cancelled') return res.status(400).json({ message: 'Booking da duoc huy truoc do' });
    if (new Date(booking.check_in) <= new Date()) {
      return res.status(400).json({ message: 'Chi co the huy truoc ngay nhan phong' });
    }

    booking.status = 'cancelled';
    if (booking.payment_status === 'paid') booking.payment_status = 'refunded';
    await booking.save();
    await logAudit({ userId: req.user.id, action: 'cancel', entity: 'booking', entityId: booking._id });
    res.json({ message: 'Huy dat phong thanh cong' });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};
