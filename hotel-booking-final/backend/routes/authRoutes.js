/**
 * authRoutes.js
 * Mục đích: Định nghĩa các route Express cho chức năng xác thực người dùng,
 * gồm đăng ký, đăng nhập, làm mới token, quên/đặt lại mật khẩu và cập nhật
 * hồ sơ/đổi mật khẩu cho tài khoản đã đăng nhập.
 */
const router = require('express').Router();
const {
  register,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// === API Đăng ký, Đăng nhập (Không yêu cầu bảo mật token) ===
// Nhóm này KHÔNG thể yêu cầu token, vì đây chính là các API dùng để LẤY token (đăng nhập)
// hoặc tạo tài khoản mới (đăng ký) - lúc gọi các API này, người dùng chưa thể có token.
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh); // Cấp lại token mới
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// === API Yêu cầu phải đăng nhập (Có middleware verifyToken) ===
// Cập nhật hồ sơ/đổi mật khẩu bắt buộc biết chính xác "đang thao tác trên tài khoản nào",
// nên phải xác thực token trước - tương tự lý do getMyBookings dùng verifyToken.
router.put('/profile', verifyToken, updateProfile); // Cập nhật thông tin cá nhân
router.put('/change-password', verifyToken, changePassword); // Đổi mật khẩu

module.exports = router;