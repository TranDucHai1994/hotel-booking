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
    const room = await getRoomById(room_id);
    if (!room) {
      return res.status(404).json({ message: 'PhÃ²ng khÃ´ng tá»“n táº¡i' });
    }

    const hotel = await getHotelById(hotel_id || room.hotel_id);
    if (!hotel) {
      return res.status(404).json({ message: 'KhÃ¡ch sáº¡n khÃ´ng tá»“n táº¡i' });
    }

    if (Number(room.hotel_id) !== Number(hotel._id)) {
      return res.status(400).json({ message: 'PhÃ²ng khÃ´ng thuá»™c khÃ¡ch sáº¡n Ä‘Ã£ chá»n' });
    }

    const dateRange = normalizeDateRange(check_in, check_out);
    if (!dateRange.hasRange || !dateRange.isValid) {
      return res.status(400).json({ message: 'NgÃ y khÃ´ng há»£p lá»‡' });
    }

    if ((room.status || 'available') !== 'available') {
      return res.status(400).json({ message: 'PhÃ²ng hiá»‡n khÃ´ng sáºµn sÃ ng Ä‘á»ƒ Ä‘áº·t' });
    }

    if (Number(guests || 0) > Number(room.max_guests || 0)) {
      return res.status(400).json({ message: 'Sá»‘ khÃ¡ch vÆ°á»£t quÃ¡ sá»©c chá»©a phÃ²ng' });
    }

    const bookedMap = await getBookedRoomCountMap({
      roomIds: [room._id],
      checkIn: dateRange.checkIn,
      checkOut: dateRange.checkOut,
    });

    const bookedCount = bookedMap.get(String(room._id)) || 0;
    const availableQuantity = Math.max(Number(room.total_quantity || 0) - bookedCount, 0);
    if (availableQuantity <= 0) {
      return res.status(400).json({ message: 'PhÃ²ng Ä‘Ã£ háº¿t chá»— trong khoáº£ng ngÃ y báº¡n chá»n' });
    }

    let bookingUser = null;
    if (req.user?.id) {
      bookingUser = await getUserById(req.user.id);
      if (!bookingUser) {
        return res.status(401).json({ message: 'TÃ i khoáº£n khÃ´ng há»£p lá»‡' });
      }
      if (bookingUser.deleted_at || bookingUser.status !== 'active') {
        return res.status(403).json({ message: 'TÃ i khoáº£n khÃ´ng thá»ƒ tiáº¿p tá»¥c Ä‘áº·t phÃ²ng' });
      }
    }

    const resolvedGuestName = bookingUser?.full_name || String(guest_name || '').trim();
    const resolvedGuestEmail = bookingUser?.email || String(guest_email || '').trim().toLowerCase();
    const resolvedGuestPhone = bookingUser?.phone || String(guest_phone || '').trim();

    if (!bookingUser && (!resolvedGuestName || !resolvedGuestEmail)) {
      return res.status(400).json({ message: 'KhÃ¡ch vÃ£ng lai cáº§n nháº­p há» tÃªn vÃ  email' });
    }

    const nights = Math.ceil((dateRange.checkOut - dateRange.checkIn) / (1000 * 60 * 60 * 24));
    const totalAmount = Number(room.price_per_night || 0) * nights;
    const resolvedPaymentMethod = ['mock_card', 'mock_momo', 'pay_at_hotel'].includes(payment_method)
      ? payment_method
      : 'pay_at_hotel';
    const paymentStatus = ['mock_card', 'mock_momo'].includes(resolvedPaymentMethod) ? 'paid' : 'unpaid';

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

    if (bookingUser) {
      await logAudit({ userId: bookingUser.id, action: 'create', entity: 'booking', entityId: booking._id });
    }

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
      message: 'Dat phong thanh cong',
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
    return res.status(500).json({ message: 'Lá»—i server', error: err.message });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const current = await getBookingById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: 'Khong tim thay booking' });
    }

    await query(
      `
        DELETE FROM dbo.Bookings
        WHERE id = @bookingId;
      `,
      { bookingId: Number(req.params.id) }
    );

    await logAudit({ userId: req.user.id, action: 'delete', entity: 'booking', entityId: req.params.id });

    return res.json({ message: 'Xoa booking thanh cong' });
  } catch (err) {
    return res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

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
      { userId: Number(req.user.id) }
    );

    return res.json(result.recordset.map(serializeJoinedBooking));
  } catch (err) {
    return res.status(500).json({ message: 'Lá»—i server', error: err.message });
  }
};

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
    return res.status(500).json({ message: 'Lá»—i server', error: err.message });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const current = await getBookingById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y booking' });
    }

    const nextStatus = String(req.body.status || '').trim();
    const nextPaymentStatus = nextStatus === 'cancelled' && current.payment_status === 'paid'
      ? 'refunded'
      : current.payment_status;

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

    await logAudit({ userId: req.user.id, action: 'update_status', entity: 'booking', entityId: req.params.id });

    return res.json({
      message: 'Cáº­p nháº­t tráº¡ng thÃ¡i thÃ nh cÃ´ng',
      booking: await getBookingById(req.params.id),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lá»—i server', error: err.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
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
      return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y booking' });
    }

    if (currentBooking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking Ä‘Ã£ Ä‘Æ°á»£c há»§y trÆ°á»›c Ä‘Ã³' });
    }

    if (new Date(currentBooking.check_in) <= new Date()) {
      return res.status(400).json({ message: 'Chá»‰ cÃ³ thá»ƒ há»§y trÆ°á»›c ngÃ y nháº­n phÃ²ng' });
    }

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

    await logAudit({ userId: req.user.id, action: 'cancel', entity: 'booking', entityId: req.params.id });

    return res.json({ message: 'Há»§y Ä‘áº·t phÃ²ng thÃ nh cÃ´ng' });
  } catch (err) {
    return res.status(500).json({ message: 'Lá»—i server', error: err.message });
  }
};

