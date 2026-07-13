const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { optionalToken, requireRoles, verifyToken } = require('../middleware/authMiddleware');

/**
 * Định tuyến cho Đặt phòng (Bookings).
 * Chia làm 2 nhóm chính: Dành cho Admin/Manager và Dành cho User (Khách/Thành viên).
 */

// Các route dành cho User (Khách hàng)
router.post('/', optionalToken, ctrl.createBooking);
router.get('/my', verifyToken, ctrl.getMyBookings);
router.put('/:id/cancel', verifyToken, ctrl.cancelBooking);

// Các route dành cho Admin/Manager
router.get('/all', verifyToken, requireRoles(['admin', 'manager']), ctrl.getAllBookings);
router.put('/:id/status', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateBookingStatus);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteBooking);

module.exports = router;
