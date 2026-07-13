const router = require('express').Router();
const ctrl = require('../controllers/roomController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

/**
 * Định tuyến (Routes) cho Quản lý Phòng.
 * Các thao tác liên quan đến lấy danh sách, thêm, sửa, xóa phòng trong khách sạn.
 */
router.get('/', ctrl.getRoomsByHotel);
router.post('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.createRoom);
router.put('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateRoom);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteRoom);

module.exports = router;
