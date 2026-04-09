const router = require('express').Router();
const { getDashboardStats } = require('../controllers/adminController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, requireRoles(['admin', 'manager']), getDashboardStats);

module.exports = router;
