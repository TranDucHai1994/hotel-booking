const { query } = require('../config/db');
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
      return res.status(400).json({ message: 'Khoảng ngày không hợp lệ' });
    }

    const from = dateRange.checkIn;
    const to = dateRange.checkOut;
    const inclusiveEnd = new Date(`${rawTo}T23:59:59.999`);
    const rangeEndExclusive = new Date(to);
    rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

    const [hotelsResult, roomsResult, bookingsResult, feedbackCountResult] = await Promise.all([
      query('SELECT * FROM dbo.Hotels;'),
      query('SELECT * FROM dbo.Rooms;'),
      query(
        `
          SELECT
            b.*,
            h.name AS hotel_name,
            r.room_type,
            r.total_quantity AS room_total_quantity,
            u.full_name AS user_full_name,
            u.email AS user_email
          FROM dbo.Bookings b
          INNER JOIN dbo.Hotels h ON h.id = b.hotel_id
          INNER JOIN dbo.Rooms r ON r.id = b.room_id
          LEFT JOIN dbo.Users u ON u.id = b.user_id
          WHERE b.created_at >= @fromDate
            AND b.created_at <= @toDate;
        `,
        {
          fromDate: parseDateStart(rawFrom),
          toDate: inclusiveEnd,
        }
      ),
      query('SELECT COUNT(*) AS count FROM dbo.Feedbacks;'),
    ]);

    const hotels = hotelsResult.recordset;
    const rooms = roomsResult.recordset;
    const bookings = bookingsResult.recordset.map((row) => ({
      ...row,
      total_amount: Number(row.total_amount || 0),
      room_total_quantity: Number(row.room_total_quantity || 0),
      user_display_name: row.user_full_name || row.guest_name || 'Khách vãng lai',
      user_display_email: row.user_email || row.guest_email || '',
    }));
    const feedbackCount = Number(feedbackCountResult.recordset[0]?.count || 0);

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
      const key = toDateKey(booking.created_at);
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
      const hotelId = String(booking.hotel_id || '');
      if (!hotelId) return;

      const current = hotelRevenueMap.get(hotelId) || {
        hotel_id: hotelId,
        hotel_name: booking.hotel_name || 'Khách sạn',
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
      .reduce((accumulator, booking) => {
        const method = booking.payment_method || 'unknown';
        accumulator[method] = (accumulator[method] || 0) + Number(booking.total_amount || 0);
        return accumulator;
      }, {});

    const recentBookings = bookings
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)
      .map((booking) => ({
        id: booking.id,
        createdAt: booking.created_at,
        hotel_name: booking.hotel_name || '',
        room_type: booking.room_type || '',
        user_name: booking.user_display_name,
        user_email: booking.user_display_email,
        amount: Number(booking.total_amount || 0),
        status: booking.status,
        payment_status: booking.payment_status,
        payment_method: booking.payment_method,
        booking_source: booking.booking_source,
      }));

    return res.json({
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
        refunded: bookings.filter((item) => item.payment_status === 'refunded').length,
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
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
