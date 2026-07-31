/**
 * adminController.js
 * Mục đích: Xử lý các API dành riêng cho Admin - thống kê dashboard (doanh thu,
 * tỷ lệ lấp đầy phòng, top khách sạn, xu hướng doanh thu theo ngày/tháng/năm)
 * và quản lý cấu hình hệ thống (email gửi thông báo).
 * Export chính: getDashboardStats, getSystemSettings, updateSystemSettings.
 */
const { query } = require('../config/db');
const { SYSTEM_SETTING_KEYS, getSettingValue, upsertSettingValue } = require('../services/systemSettingsService');
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

function pickTrendUnit(fromDate, toDate) {
  const diffDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
  if (diffDays <= 31) return 'day';
  if (diffDays <= 731) return 'month';
  return 'year';
}

function trendBucketKey(date, unit) {
  const value = new Date(date);
  if (unit === 'day') return toDateKey(value);
  if (unit === 'month') return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  return `${value.getFullYear()}`;
}

function trendBucketLabel(date, unit) {
  const value = new Date(date);
  if (unit === 'day') return toLabel(value);
  if (unit === 'month') return `Th${value.getMonth() + 1}/${value.getFullYear()}`;
  return `${value.getFullYear()}`;
}

function advanceBucket(date, unit) {
  const next = new Date(date);
  if (unit === 'day') next.setDate(next.getDate() + 1);
  else if (unit === 'month') next.setMonth(next.getMonth() + 1);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}

/**
 * API Lấy dữ liệu tổng hợp cho trang Dashboard (Admin)
 * Bao gồm: Tổng doanh thu, biểu đồ doanh thu theo ngày, tỷ lệ lấp đầy phòng, và Top khách sạn.
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Bước 1: Xác định và kiểm tra khoảng thời gian lọc (from - to), mặc định 14 ngày gần nhất.
    // - setHours(0,0,0,0): ép giờ về 00:00:00 để so sánh ngày không bị lệch bởi giờ/phút/giây
    //   hiện tại lúc gọi API.
    // - defaultFrom = hôm nay lùi 13 ngày -> cùng với "today" tạo thành khoảng mặc định
    //   14 ngày gần nhất (tính cả ngày hôm nay).
    // - req.query.from/to: nếu admin có chọn ngày trên giao diện thì ưu tiên dùng, không thì
    //   dùng khoảng mặc định.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const defaultFrom = new Date(today);
    defaultFrom.setDate(defaultFrom.getDate() - 13);

    const rawFrom = req.query.from || toDateKey(defaultFrom);
    const rawTo = req.query.to || toDateKey(today);
    const dateRange = normalizeDateRange(rawFrom, rawTo);

    // Nếu KHÔNG có bước kiểm tra này, admin lỡ nhập from sau to (vd from=30/7, to=1/7) thì
    // câu SQL bên dưới vẫn chạy với điều kiện ngày vô lý (>= 30/7 AND <= 1/7 - không ngày nào
    // thỏa cả hai), trả về danh sách rỗng - dashboard hiển thị "không có dữ liệu" dù thực tế
    // có, khiến admin hiểu lầm. Chặn ở đây bằng lỗi 400 để tránh tình huống đó.
    if (!dateRange.hasRange || !dateRange.isValid) {
      return res.status(400).json({ message: 'Khoảng ngày không hợp lệ' });
    }

    const from = dateRange.checkIn;
    const to = dateRange.checkOut;
    const inclusiveEnd = new Date(`${rawTo}T23:59:59.999`);
    const rangeEndExclusive = new Date(to);
    rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

    // Bước 2: Lấy dữ liệu thô từ CSDL song song (khách sạn, phòng, booking trong khoảng ngày, số lượng feedback).
    // Promise.all chạy 4 truy vấn CÙNG LÚC thay vì lần lượt (await từng cái), giúp giảm
    // tổng thời gian chờ xuống bằng thời gian của truy vấn CHẬM NHẤT, thay vì cộng dồn cả 4.
    // Chú ý: câu SQL bên dưới chỉ là SELECT ... WHERE ..., KHÔNG dùng SUM()/COUNT()/GROUP BY
    // để tính doanh thu ngay trong SQL. Lý do: nghiệp vụ thống kê ở các bước sau khá phức tạp
    // (nhiều điều kiện lồng nhau: đã thu tiền theo nhiều phương thức khác nhau, tính đêm phòng
    // chồng lấp theo khoảng ngày...) nên kéo dữ liệu thô về rồi tính bằng JavaScript (reduce,
    // filter) sẽ dễ đọc/dễ sửa hơn là nhồi hết logic đó vào một câu SQL khổng lồ. Đánh đổi:
    // tải nhiều dữ liệu hơn cần thiết về server Node.js rồi mới lọc/tính.
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

    // Bước 3: Tính doanh thu (đã thu, chờ thu, hoàn tiền) dựa trên trạng thái booking và thanh toán.
    // Chỉ booking 'confirmed' mới được tính là doanh thu thật/tiềm năng - 'pending' (chờ xác
    // nhận) và 'cancelled' (đã hủy) không tính vào doanh thu.
    const confirmed = bookings.filter((item) => item.status === 'confirmed');
    const pending = bookings.filter((item) => item.status === 'pending');
    const cancelled = bookings.filter((item) => item.status === 'cancelled');

    // "Đã thu tiền" được coi là true nếu payment_status = 'paid' HOẶC thanh toán qua
    // phương thức giả lập (mock_card/mock_momo dùng để demo đồ án, không tích hợp cổng
    // thanh toán thật) - vì các phương thức mock này coi như thu tiền ngay khi đặt.
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

    // Bước 4: Tính tỷ lệ lấp đầy phòng (occupancy rate) = số đêm phòng đã đặt / tổng số đêm
    // phòng khả dụng trong khoảng ngày lọc. "activeInventory" chỉ tính phòng đang ở trạng
    // thái 'available' (loại phòng đang tạm ngưng bán không tính vào mẫu số).
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

    // Bước 5: Tính xu hướng doanh thu theo mốc thời gian (ngày/tháng/năm tùy độ dài khoảng lọc).
    // pickTrendUnit tự chọn đơn vị hiển thị: <=31 ngày thì vẽ theo ngày, <=731 ngày (~2 năm)
    // thì gộp theo tháng, còn lại gộp theo năm - tránh biểu đồ có quá nhiều điểm dữ liệu
    // (nếu lọc 3 năm mà vẫn vẽ theo từng ngày thì biểu đồ sẽ rối, khó đọc).
    const trendUnit = pickTrendUnit(from, to);
    const trendMap = new Map();
    for (let cursor = new Date(from); cursor <= to; cursor = advanceBucket(cursor, trendUnit)) {
      const key = trendBucketKey(cursor, trendUnit);
      if (!trendMap.has(key)) {
        trendMap.set(key, { date: key, label: trendBucketLabel(cursor, trendUnit), value: 0 });
      }
    }

    confirmed.filter(isCollected).forEach((booking) => {
      const key = trendBucketKey(booking.created_at, trendUnit);
      if (trendMap.has(key)) {
        trendMap.get(key).value += Number(booking.total_amount || 0);
      }
    });

    const trendRevenue = Array.from(trendMap.values());

    // Bước 6: Tính top khách sạn có doanh thu cao nhất - gom nhóm booking theo hotel_id
    // bằng Map (giống GROUP BY trong SQL nhưng làm bằng JavaScript), rồi sắp xếp giảm dần
    // theo doanh thu và chỉ lấy 5 khách sạn đầu (slice(0, 5)).
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

    // Bước 7: Tổng hợp doanh thu theo phương thức thanh toán và danh sách booking gần đây
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

    // Bước 8: Trả về toàn bộ kết quả thống kê tổng hợp cho client
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
      trend_unit: trendUnit,
      top_hotels: topHotels,
      recent_bookings: recentBookings,
      range: { from: rawFrom, to: rawTo },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.getSystemSettings = async (_req, res) => {
  try {
    const emailSender = await getSettingValue(SYSTEM_SETTING_KEYS.EMAIL_SENDER, 'no-reply@hotelbooking.local');
    return res.json({
      email_sender: emailSender,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.updateSystemSettings = async (req, res) => {
  try {
    // Bước 1: Chuẩn hóa và kiểm tra email gửi không được để trống
    const emailSender = String(req.body?.email_sender || '').trim().toLowerCase();
    if (!emailSender) {
      return res.status(400).json({ message: 'Email gửi không được để trống' });
    }

    // Bước 2: Kiểm tra định dạng email hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailSender)) {
      return res.status(400).json({ message: 'Email gửi không hợp lệ' });
    }

    // Bước 3: Lưu cấu hình vào cơ sở dữ liệu và trả kết quả về cho client
    await upsertSettingValue(SYSTEM_SETTING_KEYS.EMAIL_SENDER, emailSender);

    return res.json({
      message: 'Cập nhật cấu hình hệ thống thành công',
      email_sender: emailSender,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
