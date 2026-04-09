const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

router.post('/', verifyToken, ctrl.createBooking);
router.get('/my', verifyToken, ctrl.getMyBookings);
router.get('/all', verifyToken, requireRoles(['admin', 'manager']), ctrl.getAllBookings);
router.put('/:id/status', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateBookingStatus);
router.put('/:id/cancel', verifyToken, ctrl.cancelBooking);

module.exports = router;
