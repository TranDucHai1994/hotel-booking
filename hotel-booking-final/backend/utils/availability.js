/**
 * availability.js
 * Mục đích: Chứa các hàm tiện ích xử lý ngày tháng và tính toán tình trạng
 * còn phòng (availability) cho tính năng đặt phòng, gồm chuẩn hóa khoảng
 * ngày nhận/trả phòng, đếm số phòng đã đặt, tính số phòng còn trống và
 * số đêm lưu trú/giao nhau giữa các khoảng thời gian.
 */
const { query } = require('../config/db');
const { buildInClause } = require('./sql');

// Hằng số tính số mili-giây trong một ngày (24 giờ * 60 phút * 60 giây * 1000 mili-giây)
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Hàm phân tích chuỗi ngày tháng (YYYY-MM-DD) thành đối tượng Date (lấy thời điểm 00:00:00).
 * Trả về null nếu giá trị truyền vào không hợp lệ.
 *
 * Ví dụ:
 *   parseDateStart('2026-08-01') // => Date object lúc 2026-08-01T00:00:00.000
 *   parseDateStart('abc')        // => null
 *   parseDateStart(undefined)    // => null
 */
function parseDateStart(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Hàm chuẩn hóa khoảng thời gian nhận phòng và trả phòng.
 * Đảm bảo ngày trả phòng phải lớn hơn ngày nhận phòng.
 *
 * Ví dụ:
 *   normalizeDateRange('2026-08-01', '2026-08-03')
 *   // => { checkIn: Date(2026-08-01), checkOut: Date(2026-08-03), hasRange: true, isValid: true }
 *
 *   normalizeDateRange('2026-08-03', '2026-08-01') // ngày trả trước ngày nhận
 *   // => { checkIn: Date(2026-08-03), checkOut: Date(2026-08-01), hasRange: true, isValid: false }
 *
 *   normalizeDateRange('', '2026-08-01')
 *   // => { checkIn: null, checkOut: null, hasRange: false, isValid: false }
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
 *
 * Ví dụ:
 *   const bookedMap = await getBookedRoomCountMap({
 *     roomIds: [10, 11],
 *     checkIn: new Date('2026-08-01'),
 *     checkOut: new Date('2026-08-03'),
 *   });
 *   bookedMap.get('10'); // => 2 (phòng 10 đã bị đặt 2 lần trong khoảng ngày trên)
 *   bookedMap.get('99'); // => undefined (phòng 99 không có trong Map vì chưa được đặt)
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
 *
 * Ví dụ:
 *   computeRoomAvailability({ total_quantity: 10, status: 'available' }, 8)
 *   // => { ..., available_quantity: 2, availability_status: 'limited', is_bookable: true }
 *
 *   computeRoomAvailability({ total_quantity: 10, status: 'available' }, 10)
 *   // => { ..., available_quantity: 0, availability_status: 'full', is_bookable: false }
 *
 *   computeRoomAvailability({ total_quantity: 10, status: 'maintenance' }, 0)
 *   // => { ..., available_quantity: 0, availability_status: 'maintenance', is_bookable: false }
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
 *
 * Ví dụ:
 *   computeStayNights(new Date('2026-08-01'), new Date('2026-08-04')) // => 3
 *   computeStayNights(null, new Date('2026-08-04'))                   // => 0
 */
function computeStayNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.ceil((checkOut - checkIn) / MS_PER_DAY));
}

/**
 * Hàm tính số đêm bị trùng lặp giữa một đơn đặt phòng hiện có và một khoảng thời gian được yêu cầu tìm kiếm.
 *
 * Ví dụ: đơn đặt từ 01/08 - 05/08, tìm kiếm khoảng 03/08 - 07/08 => giao nhau 03/08 - 05/08 = 2 đêm
 *   calculateOverlapNights(
 *     { check_in: '2026-08-01', check_out: '2026-08-05' },
 *     new Date('2026-08-03'),
 *     new Date('2026-08-07')
 *   ) // => 2
 *
 *   // Không giao nhau => 0
 *   calculateOverlapNights(
 *     { check_in: '2026-08-01', check_out: '2026-08-02' },
 *     new Date('2026-08-05'),
 *     new Date('2026-08-07')
 *   ) // => 0
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
