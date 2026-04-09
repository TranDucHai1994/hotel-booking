const router = require('express').Router();
const ctrl = require('../controllers/roomController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

router.get('/', ctrl.getRoomsByHotel);
router.post('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.createRoom);
router.put('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.updateRoom);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteRoom);

module.exports = router;
