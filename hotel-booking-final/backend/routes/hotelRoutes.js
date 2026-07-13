const router = require('express').Router();
const ctrl = require('../controllers/hotelController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

// === API Khách (Không cần đăng nhập) ===
router.get('/', ctrl.getHotels); // Lấy danh sách khách sạn (hỗ trợ tìm kiếm, lọc)
router.get('/:id', ctrl.getHotelById); // Xem chi tiết 1 khách sạn theo ID

// === API Quản trị (Yêu cầu đăng nhập và phải có quyền admin/manager) ===
router.post('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.createHotel);
router.put('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateHotel);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteHotel);

module.exports = router;
