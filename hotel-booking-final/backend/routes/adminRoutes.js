const router = require('express').Router();
const { getDashboardStats, getSystemSettings, updateSystemSettings } = require('../controllers/adminController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

/**
 * Định tuyến (Routes) dành cho Admin Dashboard.
 * Tất cả các route ở đây đều yêu cầu đăng nhập và có quyền 'admin' hoặc 'manager'.
 */
router.get('/dashboard', verifyToken, requireRoles(['admin', 'manager']), getDashboardStats);
router.get('/system-settings', verifyToken, requireRoles(['admin']), getSystemSettings);
router.put('/system-settings', verifyToken, requireRoles(['admin']), updateSystemSettings);

module.exports = router;
