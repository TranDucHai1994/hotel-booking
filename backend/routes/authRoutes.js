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

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/profile', verifyToken, updateProfile);
router.put('/change-password', verifyToken, changePassword);

module.exports = router;