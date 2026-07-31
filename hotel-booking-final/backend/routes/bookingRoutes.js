/**
 * bookingRoutes.js
 * Mục đích: Định nghĩa các route Express cho chức năng đặt phòng, ánh xạ
 * endpoint HTTP tới các hàm xử lý tương ứng trong bookingController.js,
 * gồm cả route cho khách hàng và route quản trị (admin/manager).
 */
const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { optionalToken, requireRoles, verifyToken } = require('../middleware/authMiddleware');

/**
 * Định tuyến cho Đặt phòng (Bookings).
 * Chia làm 2 nhóm chính: Dành cho Admin/Manager và Dành cho User (Khách/Thành viên).
 */

// Các route dành cho User (Khách hàng)
// createBooking dùng optionalToken vì nghiệp vụ cho phép Guest đặt phòng (không tài khoản).
router.post('/', optionalToken, ctrl.createBooking);
// getMyBookings/cancelBooking dùng verifyToken (bắt buộc) vì cả hai đều cần biết chính xác
// "user_id đang đăng nhập là ai" để lọc/kiểm tra đúng dữ liệu của người đó - xem thêm
// comment chi tiết trong bookingController.js.
router.get('/my', verifyToken, ctrl.getMyBookings);
router.put('/:id/cancel', verifyToken, ctrl.cancelBooking);

// Các route dành cho Admin/Manager
router.get('/all', verifyToken, requireRoles(['admin', 'manager']), ctrl.getAllBookings);
router.put('/:id/status', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateBookingStatus);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteBooking);

module.exports = router;
