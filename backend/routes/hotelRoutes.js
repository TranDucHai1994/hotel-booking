const router = require('express').Router();
const ctrl = require('../controllers/hotelController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', ctrl.getHotels);
router.get('/:id', ctrl.getHotelById);
router.post('/', verifyToken, isAdmin, ctrl.createHotel);
router.put('/:id', verifyToken, isAdmin, ctrl.updateHotel);
router.delete('/:id', verifyToken, isAdmin, ctrl.deleteHotel);

module.exports = router;