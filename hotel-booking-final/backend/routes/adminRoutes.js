/**
 * adminRoutes.js
 * Mục đích: Định nghĩa các route Express dành cho khu vực quản trị (Admin),
 * bao gồm thống kê dashboard và quản lý cấu hình hệ thống, yêu cầu quyền
 * admin/manager để truy cập.
 */
const router = require('express').Router();
const { getDashboardStats, getSystemSettings, updateSystemSettings } = require('../controllers/adminController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

/**
 * Định tuyến (Routes) dành cho Admin Dashboard.
 * Tất cả các route ở đây đều yêu cầu đăng nhập và có quyền 'admin' hoặc 'manager'.
 */
// Dashboard cho phép cả 'manager' xem, vì xem số liệu thống kê không làm thay đổi hệ thống.
router.get('/dashboard', verifyToken, requireRoles(['admin', 'manager']), getDashboardStats);
// system-settings (cấu hình email gửi hệ thống) chỉ 'admin' được xem/sửa - đây là cấu hình
// ảnh hưởng toàn hệ thống, nên giới hạn chặt hơn dashboard (chỉ đọc số liệu).
router.get('/system-settings', verifyToken, requireRoles(['admin']), getSystemSettings);
router.put('/system-settings', verifyToken, requireRoles(['admin']), updateSystemSettings);

module.exports = router;
