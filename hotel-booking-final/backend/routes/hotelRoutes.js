/**
 * hotelRoutes.js
 * Mục đích: Định nghĩa các route Express cho quản lý khách sạn, gồm API
 * công khai (xem danh sách, chi tiết khách sạn) và API quản trị (tạo, sửa,
 * xóa) yêu cầu quyền admin/manager.
 */
const router = require('express').Router();
const ctrl = require('../controllers/hotelController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

// === API Khách (Không cần đăng nhập) ===
// Xem danh sách/chi tiết khách sạn là hành động công khai, giống việc xem catalogue -
// không cần biết "ai đang xem" nên không gắn middleware xác thực nào.
router.get('/', ctrl.getHotels); // Lấy danh sách khách sạn (hỗ trợ tìm kiếm, lọc)
router.get('/:id', ctrl.getHotelById); // Xem chi tiết 1 khách sạn theo ID

// === API Quản trị (Yêu cầu đăng nhập và phải có quyền admin/manager) ===
// Tạo/sửa/xóa khách sạn làm thay đổi dữ liệu toàn hệ thống (ai cũng thấy được), nên
// phải giới hạn nghiêm ngặt hơn nhiều so với API xem - đây là điểm khác biệt cốt lõi
// giữa "đọc dữ liệu" (public) và "ghi dữ liệu" (phải xác thực + phân quyền).
router.post('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.createHotel);
router.put('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateHotel);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteHotel);

module.exports = router;
