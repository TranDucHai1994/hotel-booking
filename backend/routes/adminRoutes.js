const router = require('express').Router();
const { getDashboardStats, getSystemSettings, updateSystemSettings } = require('../controllers/adminController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, requireRoles(['admin', 'manager']), getDashboardStats);
router.get('/system-settings', verifyToken, requireRoles(['admin']), getSystemSettings);
router.put('/system-settings', verifyToken, requireRoles(['admin']), updateSystemSettings);

module.exports = router;
