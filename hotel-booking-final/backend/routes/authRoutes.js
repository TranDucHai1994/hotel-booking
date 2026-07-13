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
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh); // Cấp lại token mới
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// === API Yêu cầu phải đăng nhập (Có middleware verifyToken) ===
router.put('/profile', verifyToken, updateProfile); // Cập nhật thông tin cá nhân
router.put('/change-password', verifyToken, changePassword); // Đổi mật khẩu

module.exports = router;