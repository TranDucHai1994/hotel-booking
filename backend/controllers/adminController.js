const Booking = require('../models/Booking');
const Feedback = require('../models/Feedback');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const {
  calculateOverlapNights,
  computeStayNights,
  normalizeDateRange,
  parseDateStart,
} = require('../utils/availability');

function toDateKey(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function toLabel(date) {
  const value = new Date(date);
  return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}`;
}

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 13);

    const rawFrom = req.query.from || toDateKey(defaultFrom);
    const rawTo = req.query.to || toDateKey(today);
    const dateRange = normalizeDateRange(rawFrom, rawTo);

    if (!dateRange.hasRange || !dateRange.isValid) {
      return res.status(400).json({ message: 'Khoang ngay khong hop le' });
    }

    const from = dateRange.checkIn;
    const to = dateRange.checkOut;
    const inclusiveEnd = new Date(`${rawTo}T23:59:59.999`);
    const rangeEndExclusive = new Date(to);
    rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

    const [hotels, rooms, bookings, feedbackCount] = await Promise.all([
      Hotel.find().lean(),
      Room.find().lean(),
      Booking.find({
        createdAt: {
          $gte: parseDateStart(rawFrom),
          $lte: inclusiveEnd,
        },
      })
        .populate('hotel_id', 'name')
        .populate('room_id', 'room_type total_quantity')
        .populate('user_id', 'full_name email')
        .lean(),
      Feedback.countDocuments(),
    ]);

    const confirmed = bookings.filter((item) => item.status === 'confirmed');
    const pending = bookings.filter((item) => item.status === 'pending');
    const cancelled = bookings.filter((item) => item.status === 'cancelled');

    const isCollected = (booking) =>
      booking.payment_status === 'paid' ||
      booking.payment_method === 'mock_card' ||
      booking.payment_method === 'mock_momo';

    const revenuePaid = confirmed
      .filter(isCollected)
      .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

    const paidCount = confirmed.filter(isCollected).length;
    const revenuePending = confirmed
      .filter((item) => !isCollected(item) && item.payment_status !== 'refunded')
      .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

    const refunds = bookings
      .filter((item) => item.payment_status === 'refunded')
      .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

    const totalInventory = rooms.reduce((sum, room) => sum + Number(room.total_quantity || 0), 0);
    const activeInventory = rooms
      .filter((room) => (room.status || 'available') === 'available')
      .reduce((sum, room) => sum + Number(room.total_quantity || 0), 0);

    const occupiedRoomNights = confirmed.reduce(
      (sum, booking) => sum + calculateOverlapNights(booking, from, rangeEndExclusive),
      0
    );
    const availableRoomNights = activeInventory * Math.max(1, computeStayNights(from, rangeEndExclusive));
    const occupancyRate = availableRoomNights > 0 ? (occupiedRoomNights / availableRoomNights) * 100 : 0;

    const trendMap = {};
    for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      trendMap[toDateKey(cursor)] = 0;
    }

    confirmed.filter(isCollected).forEach((booking) => {
      const key = toDateKey(booking.createdAt);
      if (Object.prototype.hasOwnProperty.call(trendMap, key)) {
        trendMap[key] += Number(booking.total_amount || 0);
      }
    });

    const trendRevenue = Object.entries(trendMap).map(([date, value]) => ({
      date,
      label: toLabel(parseDateStart(date)),
      value,
    }));

    const hotelRevenueMap = new Map();
    confirmed.filter(isCollected).forEach((booking) => {
      const hotelId = String(booking.hotel_id?._id || booking.hotel_id || '');
      if (!hotelId) return;
      const current = hotelRevenueMap.get(hotelId) || {
        hotel_id: hotelId,
        hotel_name: booking.hotel_id?.name || 'Khach san',
        revenue_paid: 0,
        bookings_count: 0,
      };
      current.revenue_paid += Number(booking.total_amount || 0);
      current.bookings_count += 1;
      hotelRevenueMap.set(hotelId, current);
    });

    const topHotels = Array.from(hotelRevenueMap.values())
      .sort((a, b) => b.revenue_paid - a.revenue_paid)
      .slice(0, 5);

    const methodsPaidRevenue = confirmed
      .filter(isCollected)
      .reduce((acc, booking) => {
        const method = booking.payment_method || 'unknown';
        acc[method] = (acc[method] || 0) + Number(booking.total_amount || 0);
        return acc;
      }, {});

    const recentBookings = bookings
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8)
      .map((booking) => ({
        id: booking._id,
        createdAt: booking.createdAt,
        hotel_name: booking.hotel_id?.name || '',
        room_type: booking.room_id?.room_type || '',
        user_name: booking.user_id?.full_name || '',
        user_email: booking.user_id?.email || '',
        amount: Number(booking.total_amount || 0),
        status: booking.status,
        payment_status: booking.payment_status,
        payment_method: booking.payment_method,
      }));

    res.json({
      summary: {
        hotels: hotels.length,
        rooms: rooms.length,
        room_inventory: totalInventory,
        bookings: bookings.length,
        confirmed: confirmed.length,
        pending: pending.length,
        cancelled: cancelled.length,
        revenue_paid: revenuePaid,
        revenue_pending: revenuePending,
        refunds,
        profit: revenuePaid - refunds,
        paid_count: paidCount,
        avg_order_value: paidCount > 0 ? revenuePaid / paidCount : 0,
        feedback_count: feedbackCount,
        occupied_room_nights: occupiedRoomNights,
        available_room_nights: availableRoomNights,
        occupancy_rate: occupancyRate,
      },
      payment_breakdown: {
        paid: paidCount,
        unpaid: confirmed.filter((item) => !isCollected(item) && item.payment_status !== 'refunded').length,
        refunded: confirmed.filter((item) => item.payment_status === 'refunded').length,
        paid_revenue: revenuePaid,
        refunded_revenue: refunds,
        methods_paid_revenue: methodsPaidRevenue,
      },
      trend_revenue: trendRevenue,
      top_hotels: topHotels,
      recent_bookings: recentBookings,
      range: { from: rawFrom, to: rawTo },
    });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};
