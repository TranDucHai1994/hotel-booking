const router = require('express').Router();
const ctrl = require('../controllers/hotelController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

router.get('/', ctrl.getHotels);
router.get('/:id', ctrl.getHotelById);
router.post('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.createHotel);
router.put('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateHotel);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteHotel);

module.exports = router;
