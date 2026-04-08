const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.post('/', verifyToken, ctrl.createBooking);
router.get('/my', verifyToken, ctrl.getMyBookings);
router.get('/all', verifyToken, isAdmin, ctrl.getAllBookings);
router.put('/:id/status', verifyToken, isAdmin, ctrl.updateBookingStatus);
router.put('/:id/cancel', verifyToken, ctrl.cancelBooking);

module.exports = router;