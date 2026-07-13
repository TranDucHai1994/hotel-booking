const { query } = require('../config/db');
const { buildInClause } = require('./sql');

// Hằng số tính số mili-giây trong một ngày (24 giờ * 60 phút * 60 giây * 1000 mili-giây)
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Hàm phân tích chuỗi ngày tháng (YYYY-MM-DD) thành đối tượng Date (lấy thời điểm 00:00:00).
 * Trả về null nếu giá trị truyền vào không hợp lệ.
 */
function parseDateStart(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Hàm chuẩn hóa khoảng thời gian nhận phòng và trả phòng.
 * Đảm bảo ngày trả phòng phải lớn hơn ngày nhận phòng.
 */
function normalizeDateRange(checkInRaw, checkOutRaw) {
  const checkIn = parseDateStart(checkInRaw);
  const checkOut = parseDateStart(checkOutRaw);

  // Trả về false nếu không parse được ngày
  if (!checkIn || !checkOut) {
    return { checkIn: null, checkOut: null, hasRange: false, isValid: false };
  }

  return {
    checkIn,
    checkOut,
    hasRange: true,
    isValid: checkOut > checkIn, // Ngày trả phòng phải sau ngày nhận
  };
}

/**
 * Hàm truy vấn cơ sở dữ liệu để lấy số lượng phòng đã được đặt (book) trong một khoảng thời gian.
 * Có thể loại trừ một ID đặt phòng (dùng khi cập nhật đơn đặt phòng hiện tại).
 */
async function getBookedRoomCountMap({ roomIds = [], checkIn, checkOut, excludeBookingId = null }) {
  if (!Array.isArray(roomIds) || roomIds.length === 0 || !checkIn || !checkOut) {
    return new Map();
  }

  // Tạo câu lệnh IN (...) cho SQL an toàn (chống SQL Injection)
  const { clause, params } = buildInClause(roomIds, 'roomId');
  
  // Thực thi câu lệnh SQL để đếm số phòng đã đặt
  // Điều kiện: status là 'pending' (chờ) hoặc 'confirmed' (đã xác nhận)
  // và khoảng thời gian đặt phòng giao nhau với khoảng thời gian truy vấn
  const result = await query(
    `
      SELECT room_id, COUNT(*) AS count
      FROM dbo.Bookings
      WHERE status IN ('pending', 'confirmed')
        AND room_id IN (${clause})
        AND check_in < @checkOut
        AND check_out > @checkIn
        ${excludeBookingId ? 'AND id <> @excludeBookingId' : ''}
      GROUP BY room_id;
    `,
    {
      ...params,
      checkIn,
      checkOut,
      excludeBookingId: excludeBookingId || null,
    }
  );

  // Chuyển kết quả sang dạng Map với key là room_id (dạng chuỗi) và giá trị là số lượng phòng đã đặt
  return new Map(result.recordset.map((row) => [String(row.room_id), Number(row.count || 0)]));
}

/**
 * Hàm tính toán trạng thái và số lượng phòng còn trống dựa trên số lượng phòng tổng và số lượng đã đặt.
 * Gán các trạng thái hiển thị như 'available' (còn trống), 'full' (đã đầy), 'limited' (còn ít).
 */
function computeRoomAvailability(room, bookedCount = 0) {
  const totalQuantity = Number(room.total_quantity || 0);
  const status = room.status || 'available';
  const canSell = status === 'available';
  
  // Tính số lượng phòng còn trống, đảm bảo không bị số âm nếu có lỗi dữ liệu
  const availableQuantity = canSell ? Math.max(totalQuantity - bookedCount, 0) : 0;

  let availabilityStatus = 'available';
  
  // Xác định trạng thái của phòng dựa vào số lượng thực tế
  if (status === 'maintenance') availabilityStatus = 'maintenance'; // Đang bảo trì
  else if (status === 'inactive') availabilityStatus = 'inactive'; // Ngưng hoạt động
  else if (availableQuantity <= 0) availabilityStatus = 'full'; // Đã hết phòng
  else if (availableQuantity <= Math.max(1, Math.ceil(totalQuantity * 0.3))) availabilityStatus = 'limited'; // Sắp hết (còn <= 30% tổng số phòng)

  return {
    ...room,
    status,
    booked_quantity: canSell ? bookedCount : totalQuantity,
    available_quantity: availableQuantity,
    availability_status: availabilityStatus,
    is_bookable: canSell && availableQuantity > 0, // Chỉ cho phép đặt phòng nếu phòng đang sẵn sàng và còn trống
  };
}

/**
 * Hàm tính số đêm lưu trú (stay nights) dựa vào ngày nhận và ngày trả.
 */
function computeStayNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.ceil((checkOut - checkIn) / MS_PER_DAY));
}

/**
 * Hàm tính số đêm bị trùng lặp giữa một đơn đặt phòng hiện có và một khoảng thời gian được yêu cầu tìm kiếm.
 */
function calculateOverlapNights(booking, rangeStart, rangeEnd) {
  const bookingStart = new Date(booking.check_in);
  const bookingEnd = new Date(booking.check_out);
  
  // Tìm khoảng thời gian bắt đầu và kết thúc muộn nhất/sớm nhất để lấy phần giao nhau
  const overlapStart = bookingStart > rangeStart ? bookingStart : rangeStart;
  const overlapEnd = bookingEnd < rangeEnd ? bookingEnd : rangeEnd;

  // Nếu không giao nhau (thời gian kết thúc sớm hơn hoặc bằng thời gian bắt đầu)
  if (overlapEnd <= overlapStart) return 0;
  
  // Tính số ngày giao nhau dựa trên phần mili-giây
  return Math.ceil((overlapEnd - overlapStart) / MS_PER_DAY);
}

module.exports = {
  calculateOverlapNights,
  computeRoomAvailability,
  computeStayNights,
  getBookedRoomCountMap,
  normalizeDateRange,
  parseDateStart,
};
