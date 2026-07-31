/**
 * userRoutes.js
 * Mục đích: Định nghĩa các route Express quản lý người dùng dành cho Admin,
 * cho phép xem danh sách, tạo, cập nhật, khóa/mở khóa tài khoản người dùng.
 */
const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

/**
 * Định tuyến (Routes) Quản lý Người dùng dành cho Admin.
 * Cho phép Admin xem danh sách, thêm, sửa, khóa, mở khóa tài khoản.
 */

// Admin / Manager can view users; only Admin can modify
// Xem danh sách user (chỉ đọc) thì manager cũng cần để hỗ trợ công việc, nhưng các thao
// tác làm thay đổi tài khoản người khác (tạo, sửa, khóa/mở khóa) chỉ 'admin' được phép -
// cùng nguyên tắc "đọc thì lỏng hơn ghi" như ở hotelRoutes.js, áp dụng chi tiết hơn theo
// từng cấp vai trò thay vì gộp chung admin/manager cho mọi hành động.
router.get('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.listUsers);
router.post('/', verifyToken, requireRoles(['admin']), ctrl.createUser);
router.put('/:id', verifyToken, requireRoles(['admin']), ctrl.updateUser);
router.patch('/:id/lock', verifyToken, requireRoles(['admin']), ctrl.lockUser);
router.patch('/:id/unlock', verifyToken, requireRoles(['admin']), ctrl.unlockUser);

module.exports = router;

