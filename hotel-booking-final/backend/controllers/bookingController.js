/**
 * bookingController.js
 * Mục đích: Xử lý các API liên quan đến đặt phòng (tạo booking, xóa booking,
 * lấy danh sách booking của user/admin, cập nhật trạng thái booking, hủy booking).
 * Export chính: createBooking, deleteBooking, getMyBookings, getAllBookings,
 * updateBookingStatus, cancelBooking.
 */
const { query } = require('../config/db');
const { logAudit } = require('../services/auditService');
const { sendBookingConfirmationEmail, getEmailTransportInfo } = require('../services/emailService');
const { mapBooking, mapHotel, mapRoom, mapUser } = require('../utils/mappers');
const { getBookedRoomCountMap, normalizeDateRange } = require('../utils/availability');

function serializeJoinedBooking(row) {
  const booking = mapBooking(row);

  return {
    ...booking,
    user_id: row.user_ref_id
      ? {
          _id: row.user_ref_id,
          full_name: row.user_full_name,
          email: row.user_email,
        }
      : null,
    hotel_id: row.hotel_ref_id
      ? {
          _id: row.hotel_ref_id,
          name: row.hotel_name,
          city: row.hotel_city,
          cover_image: row.hotel_cover_image,
        }
      : booking.hotel_id,
    room_id: row.room_ref_id
      ? {
          _id: row.room_ref_id,
          room_type: row.room_type,
          price_per_night: Number(row.room_price_per_night || 0),
          total_quantity: Number(row.room_total_quantity || 0),
        }
      : booking.room_id,
  };
}

async function getRoomById(roomId) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Rooms
      WHERE id = @roomId;
    `,
    { roomId: Number(roomId) }
  );

  return mapRoom(result.recordset[0]);
}

async function getHotelById(hotelId) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Hotels
      WHERE id = @hotelId;
    `,
    { hotelId: Number(hotelId) }
  );

  return mapHotel(result.recordset[0]);
}

async function getUserById(userId) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Users
      WHERE id = @userId;
    `,
    { userId: Number(userId) }
  );

  return mapUser(result.recordset[0]);
}

async function getBookingById(bookingId) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Bookings
      WHERE id = @bookingId;
    `,
    { bookingId: Number(bookingId) }
  );

  return mapBooking(result.recordset[0]);
}

/**
 * Xử lý luồng Đặt phòng (Booking).
 * 1. Nhận thông tin: Khách sạn, Phòng, Ngày check-in/out, Số khách, Hình thức thanh toán.
 * 2. Kiểm tra tính hợp lệ: Phòng có thuộc khách sạn không? Ngày có hợp lệ không?
 * 3. Kiểm tra tình trạng trống (Availability): Phòng còn trống trong khoảng thời gian đó không?
 * 4. Xử lý logic thanh toán & Lưu vào CSDL.
 * 5. Gửi email xác nhận đặt phòng thành công (tùy chọn mock hoặc thực tế).
 */
exports.createBooking = async (req, res) => {
  const {
    hotel_id,
    room_id,
    check_in,
    check_out,
    guests,
    payment_method,
    customer_note,
    guest_name,
    guest_email,
    guest_phone,
  } = req.body;

  try {
    // Bước 1: Tìm phòng theo room_id, chặn ngay nếu phòng không tồn tại
    const room = await getRoomById(room_id);
    if (!room) {
      return res.status(404).json({ message: 'Phòng không tồn tại' });
    }

    // Bước 2: Tìm khách sạn tương ứng và kiểm tra phòng có đúng thuộc khách sạn đó không
    const hotel = await getHotelById(hotel_id || room.hotel_id);
    if (!hotel) {
      return res.status(404).json({ message: 'Khách sạn không tồn tại' });
    }

    if (Number(room.hotel_id) !== Number(hotel._id)) {
      return res.status(400).json({ message: 'Phòng không thuộc khách sạn đã chọn' });
    }

    // Bước 3: Kiểm tra ngày nhận/trả phòng hợp lệ (ngày trả phải sau ngày nhận)
    const dateRange = normalizeDateRange(check_in, check_out);
    if (!dateRange.hasRange || !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngày không hợp lệ' });
    }

    // Bước 4: Kiểm tra trạng thái phòng và số lượng khách có vượt sức chứa không
    if ((room.status || 'available') !== 'available') {
      return res.status(400).json({ message: 'Phòng hiện không sẵn sàng để đặt' });
    }

    if (Number(guests || 0) > Number(room.max_guests || 0)) {
      return res.status(400).json({ message: 'Số khách vượt quá sức chứa phòng' });
    }

    // Bước 5: Kiểm tra còn phòng trống trong khoảng ngày đã chọn hay không
    const bookedMap = await getBookedRoomCountMap({
      roomIds: [room._id],
      checkIn: dateRange.checkIn,
      checkOut: dateRange.checkOut,
    });

    const bookedCount = bookedMap.get(String(room._id)) || 0;
    const availableQuantity = Math.max(Number(room.total_quantity || 0) - bookedCount, 0);
    if (availableQuantity <= 0) {
      return res.status(400).json({ message: 'Phòng đã hết chỗ trong khoảng ngày bạn chọn' });
    }

    // Bước 6: Nếu đã đăng nhập thì lấy thông tin tài khoản và kiểm tra tài khoản còn hoạt động không
    let bookingUser = null;
    if (req.user?.id) {
      bookingUser = await getUserById(req.user.id);
      if (!bookingUser) {
        return res.status(401).json({ message: 'Tài khoản không hợp lệ' });
      }
      if (bookingUser.deleted_at || bookingUser.status !== 'active') {
        return res.status(403).json({ message: 'Tài khoản không thể tiếp tục đặt phòng' });
      }
    }

    // Bước 7: Xác định thông tin người đặt (ưu tiên tài khoản, nếu là khách vãng lai thì bắt buộc có tên + email)
    const resolvedGuestName = bookingUser?.full_name || String(guest_name || '').trim();
    const resolvedGuestEmail = bookingUser?.email || String(guest_email || '').trim().toLowerCase();
    const resolvedGuestPhone = bookingUser?.phone || String(guest_phone || '').trim();

    if (!bookingUser && (!resolvedGuestName || !resolvedGuestEmail)) {
      return res.status(400).json({ message: 'Khách vãng lai cần nhập họ tên và email' });
    }

    // Bước 8: Tính số đêm, tổng tiền, và xác định phương thức + trạng thái thanh toán
    const nights = Math.ceil((dateRange.checkOut - dateRange.checkIn) / (1000 * 60 * 60 * 24));
    const totalAmount = Number(room.price_per_night || 0) * nights;
    const resolvedPaymentMethod = ['mock_card', 'mock_momo', 'pay_at_hotel'].includes(payment_method)
      ? payment_method
      : 'pay_at_hotel';
    const paymentStatus = ['mock_card', 'mock_momo'].includes(resolvedPaymentMethod) ? 'paid' : 'unpaid';

    // Bước 9: Lưu đơn đặt phòng vào cơ sở dữ liệu (trạng thái ban đầu luôn là 'pending')
    const insertResult = await query(
      `
        INSERT INTO dbo.Bookings (
          user_id,
          hotel_id,
          room_id,
          guest_name,
          guest_email,
          guest_phone,
          booking_source,
          check_in,
          check_out,
          guests,
          total_amount,
          status,
          payment_method,
          payment_status,
          customer_note
        )
        OUTPUT INSERTED.*
        VALUES (
          @userId,
          @hotelId,
          @roomId,
          @guestName,
          @guestEmail,
          @guestPhone,
          @bookingSource,
          @checkIn,
          @checkOut,
          @guests,
          @totalAmount,
          N'pending',
          @paymentMethod,
          @paymentStatus,
          @customerNote
        );
      `,
      {
        userId: bookingUser?.id || null,
        hotelId: hotel._id,
        roomId: room._id,
        guestName: resolvedGuestName,
        guestEmail: resolvedGuestEmail,
        guestPhone: resolvedGuestPhone,
        bookingSource: bookingUser ? 'account' : 'guest',
        checkIn: check_in,
        checkOut: check_out,
        guests: Number(guests || 1),
        totalAmount,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus,
        customerNote: String(customer_note || '').trim(),
      }
    );

    const booking = mapBooking(insertResult.recordset[0]);

    // Bước 10: Ghi log audit nếu đặt bằng tài khoản (khách vãng lai không có audit)
    if (bookingUser) {
      await logAudit({ userId: bookingUser.id, action: 'create', entity: 'booking', entityId: booking._id });
    }

    // Bước 11: Gửi email xác nhận đặt phòng (lỗi gửi email không làm hỏng cả request)
    let mockEmail = null;
    let emailErrorMessage = null;
    try {
      mockEmail = await sendBookingConfirmationEmail({
        booking,
        hotel,
        room,
        recipientName: resolvedGuestName,
        recipientEmail: resolvedGuestEmail,
      });
    } catch (emailError) {
      emailErrorMessage = emailError.message;
      console.error('Send email failed:', emailError.message);
    }

    return res.status(201).json({
      message: 'Đặt phòng thành công',
      booking,
      email_transport: getEmailTransportInfo(),
      mock_email: mockEmail
        ? {
            to: resolvedGuestEmail,
            message_id: mockEmail.messageId,
            mode: mockEmail.mode || 'mock',
          }
        : null,
      email_error: emailErrorMessage,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Xóa vĩnh viễn một đơn đặt phòng khỏi cơ sở dữ liệu. (Dành cho admin hoặc dev test).
 * Lưu ý: Khác với việc Cancel (hủy), Delete sẽ làm mất hẳn bản ghi.
 */
exports.deleteBooking = async (req, res) => {
  try {
    const current = await getBookingById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: 'Không tìm thấy booking' });
    }

    await query(
      `
        DELETE FROM dbo.Bookings
        WHERE id = @bookingId;
      `,
      { bookingId: Number(req.params.id) }
    );

    await logAudit({ userId: req.user.id, action: 'delete', entity: 'booking', entityId: req.params.id });

    return res.json({ message: 'Xóa booking thành công' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Lấy danh sách lịch sử đặt phòng của một người dùng cụ thể (My Bookings).
 * Bảng Bookings được join với Hotels và Rooms để lấy thông tin chi tiết trả về UI.
 */
// Route dùng verifyToken (bắt buộc đăng nhập), KHÔNG dùng optionalToken như createBooking.
// Lý do: "booking của tôi" chỉ có ý nghĩa khi biết chính xác user_id từ token đã xác thực.
// Nếu req.user có thể null (như optionalToken cho phép), dòng req.user.id bên dưới sẽ
// làm server crash (lỗi 500) khi có request không kèm token.
exports.getMyBookings = async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          b.*,
          u.id AS user_ref_id,
          u.full_name AS user_full_name,
          u.email AS user_email,
          h.id AS hotel_ref_id,
          h.name AS hotel_name,
          h.city AS hotel_city,
          h.cover_image AS hotel_cover_image,
          r.id AS room_ref_id,
          r.room_type,
          r.price_per_night AS room_price_per_night,
          r.total_quantity AS room_total_quantity
        FROM dbo.Bookings b
        LEFT JOIN dbo.Users u ON u.id = b.user_id
        INNER JOIN dbo.Hotels h ON h.id = b.hotel_id
        INNER JOIN dbo.Rooms r ON r.id = b.room_id
        WHERE b.user_id = @userId
        ORDER BY b.created_at DESC;
      `,
      { userId: Number(req.user.id) } // Lọc đúng theo user đang đăng nhập, không lấy booking của người khác
    );

    return res.json(result.recordset.map(serializeJoinedBooking));
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Lấy danh sách toàn bộ các đơn đặt phòng trên hệ thống. (Dành cho Admin).
 */
exports.getAllBookings = async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          b.*,
          u.id AS user_ref_id,
          u.full_name AS user_full_name,
          u.email AS user_email,
          h.id AS hotel_ref_id,
          h.name AS hotel_name,
          h.city AS hotel_city,
          h.cover_image AS hotel_cover_image,
          r.id AS room_ref_id,
          r.room_type,
          r.price_per_night AS room_price_per_night,
          r.total_quantity AS room_total_quantity
        FROM dbo.Bookings b
        LEFT JOIN dbo.Users u ON u.id = b.user_id
        INNER JOIN dbo.Hotels h ON h.id = b.hotel_id
        INNER JOIN dbo.Rooms r ON r.id = b.room_id
        ORDER BY b.created_at DESC;
      `
    );

    return res.json(result.recordset.map(serializeJoinedBooking));
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Cập nhật trạng thái của đơn đặt phòng (VD: từ 'pending' sang 'confirmed' hoặc 'cancelled').
 * (Thường do Admin hoặc hệ thống thanh toán gọi tới).
 */
// Route dùng requireRoles(['admin', 'manager']) - chỉ admin/manager mới gọi được hàm này.
// Vì vậy KHÔNG cần thêm điều kiện "AND user_id = @userId" như cancelBooking: admin có
// quyền đổi trạng thái của BẤT KỲ booking nào, không bị giới hạn "chỉ của chính họ".
// Cũng KHÔNG chặn theo ngày check-in như cancelBooking, vì admin cần linh hoạt xử lý
// tình huống thực tế (đánh dấu hoàn tất sau khi khách trả phòng, xử lý hoàn tiền dù đã
// quá ngày nhận phòng do khiếu nại/sự cố...) - quy tắc cứng chỉ nên áp cho user tự thao tác.
exports.updateBookingStatus = async (req, res) => {
  try {
    // Bước 1: Kiểm tra booking có tồn tại không
    const current = await getBookingById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: 'Không tìm thấy booking' });
    }

    // Bước 2: Nếu chuyển sang 'cancelled' và trước đó đã thanh toán thì tự động chuyển thành 'refunded'.
    // LƯU Ý (hạn chế cần biết): nextStatus lấy thẳng từ req.body.status
    // mà KHÔNG kiểm tra giá trị này có nằm trong danh sách hợp lệ hay không (vd chỉ nên là
    // 'pending'/'confirmed'/'cancelled'/'completed'). Nếu client gửi một chuỗi bất kỳ, nó
    // vẫn được ghi thẳng vào cột status trong DB, có thể gây dữ liệu "bẩn" ảnh hưởng logic
    // ở những chỗ khác đang so sánh giá trị status này.
    const nextStatus = String(req.body.status || '').trim();
    const nextPaymentStatus = nextStatus === 'cancelled' && current.payment_status === 'paid'
      ? 'refunded'
      : current.payment_status;

    // Bước 3: Cập nhật trạng thái booking + trạng thái thanh toán vào database
    await query(
      `
        UPDATE dbo.Bookings
        SET
          status = @status,
          payment_status = @paymentStatus,
          updated_at = SYSUTCDATETIME()
        WHERE id = @bookingId;
      `,
      {
        bookingId: Number(req.params.id),
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
      }
    );

    // Bước 4: Ghi log audit và trả về booking mới nhất sau khi cập nhật
    await logAudit({ userId: req.user.id, action: 'update_status', entity: 'booking', entityId: req.params.id });

    return res.json({
      message: 'Cập nhật trạng thái thành công',
      booking: await getBookingById(req.params.id),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Người dùng tự hủy đơn đặt phòng của mình.
 * Logic: Chỉ cho phép hủy nếu thời gian hiện tại còn trước ngày nhận phòng (check_in).
 * Cập nhật trạng thái thành 'cancelled' và thanh toán thành 'refunded' (nếu đã thanh toán).
 */
exports.cancelBooking = async (req, res) => {
  try {
    // Bước 1: Lấy booking, đảm bảo đúng là booking của chính user đang đăng nhập.
    // QUAN TRỌNG: điều kiện "AND user_id = @userId" là để chống lỗi bảo mật IDOR
    // (Insecure Direct Object Reference) - nếu bỏ điều kiện này, chỉ lọc theo
    // "WHERE id = @bookingId", thì User A có thể hủy booking của User B chỉ bằng
    // cách tự đổi số id trên URL (vd: /api/bookings/57/cancel), vì hệ thống không
    // còn kiểm tra booking đó có thực sự thuộc về người đang gọi API hay không.
    const booking = await query(
      `
        SELECT TOP 1 *
        FROM dbo.Bookings
        WHERE id = @bookingId
          AND user_id = @userId;
      `,
      {
        bookingId: Number(req.params.id),
        userId: Number(req.user.id),
      }
    );

    const currentBooking = mapBooking(booking.recordset[0]);
    if (!currentBooking) {
      return res.status(404).json({ message: 'Không tìm thấy booking' });
    }

    // Bước 2: Chặn nếu đã hủy trước đó hoặc đã qua ngày nhận phòng.
    // Lý do chặn theo ngày check-in: về nghiệp vụ, phòng đã tới ngày nhận có thể đã
    // được dọn sẵn/giữ chỗ, hủy vào phút chót vẫn gây thiệt hại vận hành cho khách sạn
    // (giống việc đặt bàn nhà hàng rồi hủy ngay lúc đã ngồi vào bàn). Đây là quy tắc
    // ràng buộc cứng chỉ áp dụng cho user tự hủy - admin (updateBookingStatus) thì
    // không bị ràng buộc này vì cần sự linh hoạt xử lý tình huống thực tế.
    if (currentBooking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking đã được hủy trước đó' });
    }

    if (new Date(currentBooking.check_in) <= new Date()) {
      return res.status(400).json({ message: 'Chỉ có thể hủy trước ngày nhận phòng' });
    }

    // Bước 3: Cập nhật trạng thái 'cancelled', tự động hoàn tiền ('refunded') nếu trước đó đã thanh toán
    await query(
      `
        UPDATE dbo.Bookings
        SET
          status = N'cancelled',
          payment_status = CASE WHEN payment_status = N'paid' THEN N'refunded' ELSE payment_status END,
          updated_at = SYSUTCDATETIME()
        WHERE id = @bookingId;
      `,
      { bookingId: Number(req.params.id) }
    );

    // Bước 4: Ghi log audit cho hành động hủy
    await logAudit({ userId: req.user.id, action: 'cancel', entity: 'booking', entityId: req.params.id });

    return res.json({ message: 'Hủy đặt phòng thành công' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

