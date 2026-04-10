const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { optionalToken, requireRoles, verifyToken } = require('../middleware/authMiddleware');

router.post('/', optionalToken, ctrl.createBooking);
router.get('/my', verifyToken, ctrl.getMyBookings);
router.get('/all', verifyToken, requireRoles(['admin', 'manager']), ctrl.getAllBookings);
router.put('/:id/status', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateBookingStatus);
router.put('/:id/cancel', verifyToken, ctrl.cancelBooking);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteBooking);

module.exports = router;
