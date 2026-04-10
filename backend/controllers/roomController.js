const { query, withTransaction } = require('../config/db');
const { mapRoom } = require('../utils/mappers');
const { computeRoomAvailability, getBookedRoomCountMap, normalizeDateRange } = require('../utils/availability');
const { normalizeStringArray } = require('../utils/sql');

exports.getRoomsByHotel = async (req, res) => {
  try {
    const { hotel_id, check_in, check_out } = req.query;
    const dateRange = normalizeDateRange(check_in, check_out);

    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngày nhận/trả phòng không hợp lệ' });
    }

    const roomsResult = await query(
      `
        SELECT *
        FROM dbo.Rooms
        WHERE hotel_id = @hotelId
        ORDER BY created_at DESC;
      `,
      { hotelId: Number(hotel_id) }
    );

    const rooms = roomsResult.recordset.map(mapRoom);
    const bookedMap = dateRange.hasRange && dateRange.isValid
      ? await getBookedRoomCountMap({
          roomIds: rooms.map((room) => room._id),
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
        })
      : new Map();

    return res.json(
      rooms.map((room) => computeRoomAvailability(room, bookedMap.get(String(room._id)) || 0))
    );
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const result = await query(
      `
        INSERT INTO dbo.Rooms (
          hotel_id,
          room_type,
          max_guests,
          price_per_night,
          total_quantity,
          status,
          description,
          amenities
        )
        OUTPUT INSERTED.*
        VALUES (
          @hotelId,
          @roomType,
          @maxGuests,
          @pricePerNight,
          @totalQuantity,
          @status,
          @description,
          @amenities
        );
      `,
      {
        hotelId: Number(req.body.hotel_id),
        roomType: String(req.body.room_type || '').trim(),
        maxGuests: Number(req.body.max_guests || 2),
        pricePerNight: Number(req.body.price_per_night || 0),
        totalQuantity: Number(req.body.total_quantity || 1),
        status: String(req.body.status || 'available').trim() || 'available',
        description: String(req.body.description || '').trim(),
        amenities: JSON.stringify(normalizeStringArray(req.body.amenities)),
      }
    );

    return res.status(201).json({
      message: 'Tạo phòng thành công',
      room: mapRoom(result.recordset[0]),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const currentResult = await query(
      `
        SELECT TOP 1 *
        FROM dbo.Rooms
        WHERE id = @roomId;
      `,
      { roomId: Number(req.params.id) }
    );

    const currentRoom = mapRoom(currentResult.recordset[0]);
    if (!currentRoom) {
      return res.status(404).json({ message: 'Không tìm thấy phòng' });
    }

    await query(
      `
        UPDATE dbo.Rooms
        SET
          hotel_id = @hotelId,
          room_type = @roomType,
          max_guests = @maxGuests,
          price_per_night = @pricePerNight,
          total_quantity = @totalQuantity,
          status = @status,
          description = @description,
          amenities = @amenities,
          updated_at = SYSUTCDATETIME()
        WHERE id = @roomId;
      `,
      {
        roomId: currentRoom._id,
        hotelId: Number(req.body.hotel_id ?? currentRoom.hotel_id),
        roomType: String(req.body.room_type ?? currentRoom.room_type).trim(),
        maxGuests: Number(req.body.max_guests ?? currentRoom.max_guests),
        pricePerNight: Number(req.body.price_per_night ?? currentRoom.price_per_night),
        totalQuantity: Number(req.body.total_quantity ?? currentRoom.total_quantity),
        status: String(req.body.status ?? currentRoom.status).trim() || 'available',
        description: String(req.body.description ?? currentRoom.description).trim(),
        amenities: JSON.stringify(
          req.body.amenities !== undefined ? normalizeStringArray(req.body.amenities) : currentRoom.amenities
        ),
      }
    );

    const updatedResult = await query(
      `
        SELECT TOP 1 *
        FROM dbo.Rooms
        WHERE id = @roomId;
      `,
      { roomId: currentRoom._id }
    );

    return res.json({
      message: 'Cập nhật thành công',
      room: mapRoom(updatedResult.recordset[0]),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const deleted = await withTransaction(async (transaction) => {
      const roomId = Number(req.params.id);
      const existing = await query(
        `
          SELECT TOP 1 id
          FROM dbo.Rooms
          WHERE id = @roomId;
        `,
        { roomId },
        { transaction }
      );

      if (!existing.recordset[0]) {
        return false;
      }

      await query(
        `
          DELETE FROM dbo.Bookings
          WHERE room_id = @roomId;
        `,
        { roomId },
        { transaction }
      );

      await query(
        `
          DELETE FROM dbo.Rooms
          WHERE id = @roomId;
        `,
        { roomId },
        { transaction }
      );

      return true;
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy phòng' });
    }

    return res.json({ message: 'Xóa thành công' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
