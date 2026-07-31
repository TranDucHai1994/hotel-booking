/**
 * roomController.js
 * Mục đích: Xử lý các API quản lý phòng khách sạn - lấy danh sách phòng theo
 * khách sạn (kèm tính toán số phòng trống theo ngày), và CRUD phòng dành cho
 * Admin (xóa phòng sẽ xóa kèm các booking liên quan trong transaction).
 * Export chính: getRoomsByHotel, createRoom, updateRoom, deleteRoom.
 */
const { query, withTransaction } = require('../config/db');
const { mapRoom } = require('../utils/mappers');
const { computeRoomAvailability, getBookedRoomCountMap, normalizeDateRange } = require('../utils/availability');
const { normalizeStringArray } = require('../utils/sql');

/**
 * Lấy danh sách phòng thuộc về một khách sạn cụ thể.
 * Có tính toán số lượng phòng trống nếu có truyền vào check_in và check_out.
 */
exports.getRoomsByHotel = async (req, res) => {
  try {
    // Bước 1: Kiểm tra khoảng ngày check_in/check_out có hợp lệ không
    const { hotel_id, check_in, check_out } = req.query;
    const dateRange = normalizeDateRange(check_in, check_out);

    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngày nhận/trả phòng không hợp lệ' });
    }

    // Bước 2: Lấy danh sách phòng thuộc khách sạn
    const roomsResult = await query(
      `
        SELECT *
        FROM dbo.Rooms
        WHERE hotel_id = @hotelId
        ORDER BY created_at DESC;
      `,
      { hotelId: Number(hotel_id) }
    );

    // Bước 3: Nếu có khoảng ngày hợp lệ thì tính số phòng đã đặt để suy ra số phòng còn trống
    const rooms = roomsResult.recordset.map(mapRoom);
    const bookedMap = dateRange.hasRange && dateRange.isValid
      ? await getBookedRoomCountMap({
          roomIds: rooms.map((room) => room._id),
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
        })
      : new Map();

    // Bước 4: Trả về danh sách phòng kèm số lượng còn trống đã tính toán
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
    // Bước 1: Tìm phòng hiện tại theo ID, chặn ngay nếu không tồn tại
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

    // Bước 2: Cập nhật các trường vào database (giữ giá trị cũ nếu request không truyền lên)
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

    // Bước 3: Lấy lại bản ghi mới nhất sau khi cập nhật để trả về cho client
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
      // Bước 1: Kiểm tra phòng có tồn tại không, chặn ngay nếu không tìm thấy
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

      // Bước 2: Xóa các đơn đặt phòng liên quan đến phòng này
      await query(
        `
          DELETE FROM dbo.Bookings
          WHERE room_id = @roomId;
        `,
        { roomId },
        { transaction }
      );

      // Bước 3: Xóa chính bản ghi phòng
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
