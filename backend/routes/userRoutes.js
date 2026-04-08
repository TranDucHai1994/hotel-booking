const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

// Admin / Manager can view users; only Admin can modify
router.get('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.listUsers);
router.post('/', verifyToken, requireRoles(['admin']), ctrl.createUser);
router.put('/:id', verifyToken, requireRoles(['admin']), ctrl.updateUser);
router.patch('/:id/lock', verifyToken, requireRoles(['admin']), ctrl.lockUser);
router.patch('/:id/unlock', verifyToken, requireRoles(['admin']), ctrl.unlockUser);

module.exports = router;

