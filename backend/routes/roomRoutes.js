const router = require('express').Router();
const ctrl = require('../controllers/roomController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', ctrl.getRoomsByHotel);
router.post('/', verifyToken, isAdmin, ctrl.createRoom);
router.put('/:id', verifyToken, isAdmin, ctrl.updateRoom);
router.delete('/:id', verifyToken, isAdmin, ctrl.deleteRoom);

module.exports = router;